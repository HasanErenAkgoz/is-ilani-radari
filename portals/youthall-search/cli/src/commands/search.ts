import {
  BASE,
  LIST_PATH,
  citySlug,
  htmlFetch,
  parseJobCards,
  parseJobDetail,
  stripInvisible,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  type?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Hard cap on detail requests --jobage may spend (it needs each posting's publication date). */
export const MAX_JOBAGE_DETAILS = 20

/**
 * Youthall filters by path facet (/tr/is-ilanlari/istanbul/, /tam-zamanli/,
 * /istanbul-tam-zamanli/). Its ?city[]= and ?type[]= form parameters return no
 * rows when requested directly, and a facet path combined with ?query= also
 * returns none, so a keyword search always runs on the hub and --location is
 * then applied to the cards client-side (see SKILL.md).
 */
export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  let path = LIST_PATH
  if (opts.query) {
    params.set("query", opts.query)
  } else {
    const parts = [opts.location ? citySlug(opts.location) : "", opts.type ?? ""].filter(Boolean)
    if (parts.length) path += `${parts.join("-")}/`
  }
  if (opts.page > 1) params.set("page", String(opts.page))
  const qs = params.toString()
  return `${BASE}${path}${qs ? `?${qs}` : ""}`
}

/** Client-side location match for keyword searches: the card's location tag names the city. */
export function matchesLocation(card: JobCard, location: string): boolean {
  if (!card.location) return false
  return citySlug(card.location).includes(citySlug(location))
}

function daysAgo(iso: string, now: Date): number {
  return (now.getTime() - new Date(`${iso}T00:00:00Z`).getTime()) / 86_400_000
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header =
    "ID".padEnd(44) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(14) + " " + "DEADLINE".padEnd(10) + " POSTED"
  const rows = cards.map((c) =>
    [
      c.id.slice(0, 44).padEnd(44),
      (c.title || "").slice(0, 40).padEnd(40),
      (c.company || "—").slice(0, 22).padEnd(22),
      (c.location || "—").slice(0, 14).padEnd(14),
      (c.deadline || "—").padEnd(10),
      c.date || "—",
    ].join(" "),
  )
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = parseJobCards(html)
    if (opts.query && opts.location) cards = cards.filter((c) => matchesLocation(c, opts.location!))
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.jobage !== undefined) {
      // The card shows only the deadline; the publication date lives in the
      // posting's JSON-LD. Fetch it per card, bounded, then filter.
      const now = new Date()
      const kept: JobCard[] = []
      for (const card of cards.slice(0, MAX_JOBAGE_DETAILS)) {
        const detailHtml = await htmlFetch(card.url)
        const detail = detailHtml ? parseJobDetail(detailHtml, card.id) : null
        card.date = detail?.date ?? null
        // Unknown publication date is kept (and stays null) rather than guessed.
        if (card.date === null || daysAgo(card.date, now) <= opts.jobage) kept.push(card)
      }
      cards = kept
    }

    cards = stripInvisible(cards)
    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.type || "—"} · son başvuru ${c.deadline || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, page: opts.page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
