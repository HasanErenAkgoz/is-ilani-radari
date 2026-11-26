// Data source: Kariyer.net public search pages (server-side rendered Nuxt app).
// GET https://www.kariyer.net/is-ilanlari[/<city-slug>]?kw=<query>&cp=<page>
// Each result is a <div data-test="ad-card" ...> whose opening tag carries
// attributes (positionName, cityName, workModelText, time) and whose body holds
// the link, title, company and location. We split on the card marker and parse
// each chunk independently so one malformed card cannot break the rest.

export const BASE_URL = "https://www.kariyer.net"
export const SEARCH_PATH = "/is-ilanlari"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; kariyernet-cli/1.0)"

/** Error carrying the HTTP status so callers can tell a WAF block from a failure. */
export class HttpError extends Error {
  status: number
  constructor(status: number, statusText: string) {
    super(`Request failed: ${status} ${statusText}`)
    this.status = status
  }
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) throw new HttpError(response.status, response.statusText)
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) throw new HttpError(response.status, response.statusText)
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  workModel: string | null
  /** Approximate posting date (YYYY-MM-DD) derived from the portal's relative age text. */
  date: string | null
  /** The portal's own relative age text, e.g. "1 gün". */
  dateText: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  /** "Aday Kriterleri" box, e.g. { "Tecrübe": "En az 2 yıl tecrübeli", "Yabancı Dil": "İngilizce(...)" }. */
  criteria: Record<string, string>
  employmentType: string | null
  deadline: string | null
  isActive: boolean
}

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
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Characters a reader of the posting never sees but a model reading this
 * output does: controls, soft hyphen, bidi marks, zero-width characters, BOM,
 * variation selectors and Unicode tag characters.
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
 * Drop markup a browser never renders (comments, <script>/<style>/<template>,
 * elements marked hidden) before tags are stripped, so the model is not handed
 * text the posting's reader never saw.
 */
export function visibleHtml(html: string): string {
  const src = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
  const open = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g
  const kept: string[] = []
  let from = 0
  let m: RegExpExecArray | null
  while ((m = open.exec(src)) !== null) {
    if (!m[2] || !isHiddenTag(m[2])) continue
    const tag = m[1].toLowerCase()
    let end = open.lastIndex
    if (!VOID_TAGS.has(tag) && !m[0].endsWith("/>")) {
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

/** Turkish city/location text to the portal's URL slug: "İstanbul" -> "istanbul", "Çanakkale" -> "canakkale". */
export function citySlug(location: string): string {
  return location
    .trim()
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Age in days from the portal's relative text ("5 saat", "1 gün", "2 hafta", "1 ay"), or null if unrecognised. */
export function ageDays(text: string | null): number | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/bugün/.test(t)) return 0
  const m = t.match(/(\d+)\s*(dakika|dk|saat|gün|hafta|ay)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  switch (m[2]) {
    case "dakika":
    case "dk":
    case "saat":
      return 0
    case "gün":
      return n
    case "hafta":
      return n * 7
    case "ay":
      return n * 30
    default:
      return null
  }
}

/** Approximate posting date (YYYY-MM-DD) from relative age text. */
export function relativeToDate(text: string | null, now: Date = new Date()): string | null {
  const days = ageDays(text)
  if (days === null) return null
  const d = new Date(now.getTime() - days * 86400000)
  return d.toISOString().slice(0, 10)
}

function attr(head: string, name: string): string | null {
  const m = head.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return m ? decodeHtmlEntities(m[1]) : null
}

/**
 * Parse the search response. Splits on the card marker and parses each chunk
 * independently; duplicate ids (sponsored + organic) are dropped.
 */
export function parseJobCards(html: string, now: Date = new Date()): JobCard[] {
  const results: JobCard[] = []
  const seen = new Set<string>()
  const chunks = html.split(/data-test="ad-card" /).slice(1)

  for (const chunk of chunks) {
    const headEnd = chunk.indexOf(">")
    const head = headEnd === -1 ? "" : chunk.slice(0, headEnd)

    const href = chunk.match(/href="(\/is-ilani\/[^"?#]+)/i)
    if (!href) continue
    const idMatch = href[1].match(/-(\d{5,})$/)
    if (!idMatch) continue
    const id = idMatch[1]
    if (seen.has(id)) continue

    let title: string | null = null
    const t = chunk.match(/data-test="ad-card-title"[^>]*>([\s\S]*?)<\/span>/i)
    if (t) title = clean(t[1]) || null
    if (!title) title = attr(head, "positionName")
    if (!title) continue

    const sub = chunk.match(/data-test="subtitle"[^>]*>([\s\S]*?)<\/span>/i)
    const company = sub ? clean(sub[1]) || null : null

    const loc = chunk.match(/data-test="location"[^>]*>([\s\S]*?)<\/span>/i)
    const location = (loc ? clean(loc[1]) || null : null) ?? attr(head, "cityName")

    const wm = chunk.match(/data-test="work-model"[^>]*>([\s\S]*?)<\/span>/i)
    const workModel = (wm ? clean(wm[1]) || null : null) ?? attr(head, "workModelText")

    const dateText = attr(head, "time")

    seen.add(id)
    results.push({
      id,
      title,
      company,
      location,
      workModel,
      date: relativeToDate(dateText, now),
      dateText,
      url: `${BASE_URL}${href[1]}`,
    })
  }

  return results
}

function htmlToText(html: string): string {
  const withBreaks = visibleHtml(html)
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  return withBreaks.split("\n").map(clean).join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** Inner HTML of the first element carrying data-test="<name>", tracking nesting of the same tag. */
function extractByDataTest(html: string, name: string): string | null {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*data-test="${name}"[^>]*>`, "i").exec(html)
  if (!open) return null
  const tag = open[1].toLowerCase()
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
  const start = open.index + open[0].length
  re.lastIndex = start
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1]) depth--
    else if (!m[0].endsWith("/>")) depth++
    if (depth === 0) return html.slice(start, m.index)
  }
  return null
}

/** "17.12.2026" -> "2026-12-17"; null if it is not that shape. */
function trDateToIso(text: string | null): string | null {
  const m = text?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Parse a posting detail page (server-rendered; markers verified against a live
 * page on 2026-11-20): title/company/location from data-test spans, the body from
 * data-test="qualifications-and-job-description", the "Aday Kriterleri" box
 * (experience, education, language) from alignment-list-title/value pairs, and
 * the closing date from the closingDate attribute on the job container.
 * Fields that cannot be found come back null; the caller treats a page with
 * neither company nor description as a failed parse.
 */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const text = (name: string): string | null => {
    const inner = extractByDataTest(html, name)
    return inner ? clean(inner) || null : null
  }

  const bodyHtml = extractByDataTest(html, "qualifications-and-job-description")
  const description = bodyHtml ? htmlToText(bodyHtml) || null : null

  const criteria: Record<string, string> = {}
  for (const m of html.matchAll(
    /data-test="alignment-list-title"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*data-test="alignment-list-value"[^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const key = clean(m[1]).replace(/^[•\s]+/, "")
    if (key) criteria[key] = clean(m[2])
  }

  const closing = trDateToIso(html.match(/\sclosingDate="([^"]*)"/i)?.[1] ?? null)
  const published = trDateToIso(html.match(/\slastPublishDate="([^"]*)"/i)?.[1] ?? null)
  const activeAttr = html.match(/\sisActive="([^"]*)"/i)?.[1] ?? null
  const today = new Date().toISOString().slice(0, 10)

  return {
    id,
    title: text("job-title") ?? "(untitled)",
    company: text("company-title"),
    location: text("company-location"),
    workModel: null,
    date: published,
    dateText: null,
    url,
    description,
    criteria,
    employmentType: null,
    deadline: closing,
    // true only means no closed marker and no past deadline was found.
    isActive: activeAttr !== "false" && (closing ? closing >= today : true),
  }
}
