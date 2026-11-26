import {
  BASE_URL,
  SEARCH_PATH,
  ageDays,
  citySlug,
  htmlFetch,
  parseJobCards,
  stripInvisible,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildUrl(opts: SearchOpts): string {
  const slug = opts.location ? citySlug(opts.location) : ""
  const path = slug ? `${SEARCH_PATH}/${slug}` : SEARCH_PATH
  const params = new URLSearchParams()
  if (opts.query) params.set("kw", opts.query)
  if (opts.page > 1) params.set("cp", String(opts.page))
  const qs = params.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ""}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const wm = (c.workModel || "—").slice(0, 12).padEnd(12)
    return `${c.id.padEnd(8)} ${title} ${company} ${loc} ${wm} ${c.dateText || "—"}`
  })
  const header =
    "ID".padEnd(8) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(20) + " " + "MODEL".padEnd(12) + " AGE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = stripInvisible(parseJobCards(html))
    // The portal's age filter is not documented, so --jobage is applied here,
    // from the relative age text on each card. Cards with unrecognised age text are kept.
    if (opts.jobage < 9999) {
      cards = cards.filter((c) => {
        const d = ageDays(c.dateText)
        return d === null || d <= opts.jobage
      })
    }
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workModel || "—"} · ${c.dateText || "—"}\n  id: ${c.id}\n  ${c.url}`,
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
