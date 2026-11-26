// Data source: Youthall's public, server-rendered job listing pages.
//   search: https://www.youthall.com/tr/is-ilanlari/[<facet>/]?query=<q>&page=<n>
//   detail: https://www.youthall.com/tr/<company-slug>/<posting-slug>/  (schema.org JobPosting JSON-LD)
// No authentication, no API key, zero runtime dependencies. robots.txt allows the
// listing pages and the ?query/?page parameters (checked 2026-11-13).
//
// Personal use only: keep volume low (a handful of requests per run).

export const BASE = "https://www.youthall.com"
export const LIST_PATH = "/tr/is-ilanlari/"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; youthall-cli/1.0)"

/** Fetch HTML with exponential backoff + jitter on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  /** Publication date (YYYY-MM-DD). Not on the listing card: null unless filled from the detail page. */
  date: string | null
  /** Application deadline (YYYY-MM-DD), shown on the listing card. */
  deadline: string | null
  /** Youthall's own engagement label, e.g. "Tam Zamanlı", "Stajyer", "Serbest Zamanlı". */
  type: string | null
  snippet: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  locations: string[]
  directApply: boolean | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji, U+1F600)
 * decode correctly, and drops out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Numeric character references: decimal (&#233;) and hexadecimal (&#xE9;).
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Characters a reader of the posting never sees but a model reading this
 * output does: C0/C1 controls other than tab, newline and carriage return, the
 * soft hyphen, bidi marks/embeddings/overrides/isolates, zero-width characters
 * and invisible operators, the BOM, variation selectors, and Unicode tag
 * characters (U+E0000-E007F), which can spell out a whole hidden instruction.
 * Listing text is third-party data, and these arrive raw in a portal's JSON or
 * markup as easily as through a numeric entity.
 */
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯︀-️﻿\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu

/** Strip INVISIBLE_CHARS from every string in a result, recursively: the CLI's output boundary. */
export function stripInvisible<T>(value: T): T {
  if (typeof value === "string") return value.replace(INVISIBLE_CHARS, "") as T
  if (Array.isArray(value)) return value.map(stripInvisible) as T
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripInvisible(v)])) as T
  }
  return value
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])

/** Whether an opening tag's attributes keep it from rendering: `hidden`, or an inline style that hides it. */
function isHiddenTag(attrs: string): boolean {
  for (const m of attrs.matchAll(/([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ""
    if (name === "hidden") return true
    if (name === "style" && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)\b/i.test(value)) {
      return true
    }
  }
  return false
}

/**
 * Drop markup a browser never renders - comments (including Word's
 * conditional ones), <script>/<style>/<template> blocks, and elements marked
 * hidden - before tags are stripped. A plain tag strip keeps their text, which
 * hands the model words the posting's reader never saw. CSS-only tricks
 * (off-screen, zero font size) need a renderer and are not caught here.
 */
export function visibleHtml(html: string): string {
  const src = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
  // One pass, collecting what is kept: slicing the string per hidden element
  // would make a page full of them quadratic.
  const open = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g
  const kept: string[] = []
  let from = 0
  let m: RegExpExecArray | null
  while ((m = open.exec(src)) !== null) {
    if (!m[2] || !isHiddenTag(m[2])) continue
    const tag = m[1].toLowerCase()
    let end = open.lastIndex
    if (!VOID_TAGS.has(tag) && !m[0].endsWith("/>")) {
      // Skip to the matching close tag, counting nested same-name elements. An
      // unclosed hidden element runs to the end: failing closed drops visible
      // text, failing open would leak the hidden text.
      const same = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
      same.lastIndex = end
      end = src.length
      let depth = 1
      let s: RegExpExecArray | null
      while ((s = same.exec(src)) !== null) {
        if (s[1]) depth--
        else if (!s[0].endsWith("/>")) depth++
        if (depth === 0) {
          end = same.lastIndex
          break
        }
      }
    }
    kept.push(src.slice(from, m.index))
    from = end
    open.lastIndex = end
  }
  kept.push(src.slice(from))
  return kept.join("")
}

function stripTags(html: string): string {
  return visibleHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** "26.11.2026" -> "2026-11-26"; anything else -> null. */
export function trDateToIso(s: string | null | undefined): string | null {
  const m = (s || "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
}

const YOUTHALL_HOST = /^(www\.)?youthall\.com$/i
const NON_POSTING_FIRST_SEGMENTS = new Set([
  "is-ilanlari", "etkinlikler", "sirketler", "maaslar", "okullar", "rehber", "araclar",
  "yetenek-programlari", "youth", "company", "sozlesmeler", "youth-awards", "oyunlar",
  "ayricaliklar", "premium", "academy", "banner",
])

/**
 * A posting id is "<company-slug>/<posting-slug>", the two path segments after /tr/.
 * Accepts that id or a full youthall.com posting URL; anything else (other hosts,
 * look-alike hosts, listing/company pages) is rejected.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-z0-9-]+\/[a-z0-9_-]+\/?$/i.test(trimmed)) {
    const [company, slug] = trimmed.replace(/\/$/, "").split("/")
    return NON_POSTING_FIRST_SEGMENTS.has(company.toLowerCase()) ? null : `${company}/${slug}`
  }
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && !/^(www\.)?youthall\.com\//i.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (!YOUTHALL_HOST.test(parsed.hostname)) return null
  const m = parsed.pathname.match(/^\/(?:tr|en)\/([a-z0-9-]+)\/([a-z0-9_-]+)\/?$/i)
  if (!m || NON_POSTING_FIRST_SEGMENTS.has(m[1].toLowerCase())) return null
  return `${m[1]}/${m[2]}`
}

export function postingUrl(id: string): string {
  return `${BASE}/tr/${id}/`
}

function tagText(chunk: string, icon: RegExp): string | null {
  const m = chunk.match(new RegExp(`<i class="[^"]*${icon.source}[^"]*"[^>]*><\\/i>([\\s\\S]*?)<\\/div>`, "i"))
  return m ? clean(m[1]) || null : null
}

/**
 * Parse the list-view cards (".jobs-row"). The page renders every posting twice
 * (grid and list view); only the list view carries the company name, so only it
 * is parsed. Each card is parsed independently so one malformed card cannot
 * break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const start = html.indexOf('id="internshipsList"')
  const region = start === -1 ? html : html.slice(start)
  const chunks = region.split(/<div class="jobs-row">/).slice(1)
  const results: JobCard[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const href = chunk.match(/<a href="([^"]+)" class="jobs-row__link"/i)
    if (!href) continue
    const url = decodeHtmlEntities(href[1])
    const id = normalizeId(url)
    if (!id || seen.has(id)) continue
    const titleM = chunk.match(/<div class="jobs-row__title">[\s\S]*?<h5>([\s\S]*?)<\/h5>/i)
    const title = titleM ? clean(titleM[1]) : ""
    if (!title) continue
    seen.add(id)
    const companyM = chunk.match(/<span class="jobs-row__company">([\s\S]*?)<\/span>/i)
    const descM = chunk.match(/<div class="jobs-row__desc">([\s\S]*?)<\/div>/i)
    results.push({
      id,
      title,
      company: companyM ? clean(companyM[1]) || null : null,
      location: tagText(chunk, /fa-map-marker-alt/),
      date: null,
      deadline: trDateToIso(tagText(chunk, /fa-clock/)),
      type: tagText(chunk, /fa-briefcase/),
      snippet: descM ? clean(descM[1]) || null : null,
      url: postingUrl(id),
    })
  }
  return results
}

/** Highest ?page=N linked from a listing page (1 when there is no pagination). */
export function lastPage(html: string): number {
  let max = 1
  for (const m of html.matchAll(/[?&](?:amp;)?page=(\d+)/g)) max = Math.max(max, parseInt(m[1], 10))
  return max
}

const EMPLOYMENT_MAP: Record<string, string> = {
  FULL_TIME: "full_time", PART_TIME: "part_time", CONTRACTOR: "contract", TEMPORARY: "contract",
  INTERN: "internship", VOLUNTEER: "volunteer", PER_DIEM: "contract", OTHER: "other",
}

function descriptionText(html: string): string | null {
  const withBreaks = visibleHtml(html)
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  return withBreaks.split("\n").map(clean).filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n").replace(/\n{3,}/g, "\n\n").trim() || null
}

/** Parse a posting page via its schema.org JobPosting JSON-LD block. Returns null when there is none. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  let posting: Record<string, any> | null = null
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1])
      const list = Array.isArray(d) ? d : [d]
      const hit = list.find((x) => x && x["@type"] === "JobPosting")
      if (hit) { posting = hit; break }
    } catch {
      continue
    }
  }
  if (!posting) return null
  const places: string[] = []
  for (const loc of ([] as any[]).concat(posting.jobLocation ?? [])) {
    const city = loc?.address?.addressLocality
    if (typeof city === "string" && city && !places.includes(city)) places.push(clean(city))
  }
  const remote = posting.jobLocationType === "TELECOMMUTE"
  const rawType = ([] as any[]).concat(posting.employmentType ?? [])[0]
  const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
  const location = remote ? "Uzaktan" : places.length === 0 ? null : places.length >= 81 ? "Tüm Türkiye" : places.length <= 3 ? places.join(", ") : `${places.slice(0, 3).join(", ")} +${places.length - 3}`
  return {
    id,
    title: typeof posting.title === "string" ? clean(posting.title) : "(untitled)",
    company: typeof posting.hiringOrganization?.name === "string" ? clean(posting.hiringOrganization.name) || null : null,
    location,
    locations: places,
    date: iso(posting.datePosted),
    deadline: iso(posting.validThrough),
    type: null,
    snippet: null,
    url: postingUrl(id),
    description: typeof posting.description === "string" ? descriptionText(posting.description) : null,
    employmentType: typeof rawType === "string" ? EMPLOYMENT_MAP[rawType] ?? rawType.toLowerCase() : null,
    directApply: typeof posting.directApply === "boolean" ? posting.directApply : null,
  }
}

/** Youthall's own path facets (llms.txt "URL kalıpları"). */
export const TYPE_FACETS = [
  "stajyer", "yeni-mezun", "tam-zamanli", "part-time", "management-trainee",
  "genc-profesyonel", "sozlesmeli", "proje-bazli", "freelance", "gonullu",
] as const

/** "İstanbul" -> "istanbul", "Kocaeli" -> "kocaeli": the slug Youthall uses in facet paths. */
export function citySlug(city: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" }
  return city.trim().replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => map[c]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
