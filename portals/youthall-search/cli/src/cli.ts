#!/usr/bin/env bun
// Self-contained CLI for searching Youthall (youthall.com), Türkiye's student /
// new-graduate / young-professional job board. Zero runtime dependencies: runs
// anywhere `bun` is available.
//
// Personal use only. Reads Youthall's public listing pages; keep volume low and
// do not use it commercially or for bulk data collection.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { TYPE_FACETS } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit", t: "type" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `youthall-cli — search jobs and internships on Youthall (Türkiye)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (Youthall's own search box). Optional: omit to list all open postings.
  --location, -l <city>   City, e.g. "İstanbul", "Ankara". Without --query it uses Youthall's city
                          page; with --query it filters the results client-side on the card's city.
  --type, -t <facet>      ${TYPE_FACETS.join(" | ")}.
                          Cannot be combined with --query (Youthall returns nothing for that combination).
  --jobage <days>         Posted within N days. Costs one detail request per result (max 20).
  --page <n>              1-indexed page (18 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "yazılım" --format table
  bun run src/cli.ts search -l "İstanbul" -t tam-zamanli --format table
  bun run src/cli.ts search -q developer -l İstanbul --jobage 14
  bun run src/cli.ts detail workintech/aranan-meslekler-ai-developer-ve-data-scientist-workintech-te_9 --format plain

Personal use only — keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "type", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function fail(error: string, code: string): number {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  return 1
}

function wholeNumber(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    fail(`--${name} must be a whole number of at least 1, got "${raw}"`, "BAD_ARG")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      return fail(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help`,
        "UNKNOWN_FLAG",
      )
    }
  }

  if (cmd === "search") {
    for (const name of ["query", "location", "type"]) {
      if (flags[name] !== undefined && (typeof flags[name] !== "string" || !(flags[name] as string).trim())) {
        return fail(`--${name} requires a non-empty value`, "BAD_ARG")
      }
    }
    const type = typeof flags.type === "string" ? flags.type.trim().toLowerCase() : undefined
    if (type && !(TYPE_FACETS as readonly string[]).includes(type)) {
      return fail(`--type must be one of ${TYPE_FACETS.join("|")}, got "${flags.type}"`, "BAD_ARG")
    }
    if (type && flags.query !== undefined) {
      return fail(
        "--type cannot be combined with --query: Youthall returns no rows for a facet page with a keyword. Search by keyword, or list a facet without one",
        "CONFLICTING_FLAGS",
      )
    }
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) {
      return fail(`--format must be one of json|table|plain, got "${fmt}"`, "BAD_ARG")
    }
    const nums: Record<string, number | undefined> = {}
    for (const name of ["jobage", "page", "limit"]) {
      if (flags[name] === undefined) continue
      const v = wholeNumber(name, flags[name])
      if (v === null) return 1
      nums[name] = v
    }
    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query.trim() : undefined,
      location: typeof flags.location === "string" ? flags.location.trim() : undefined,
      type,
      jobage: nums.jobage,
      page: nums.page ?? 1,
      limit: nums.limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) return fail("detail requires an <id|url>", "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) {
      return fail(`--format must be one of json|plain, got "${fmt}"`, "BAD_ARG")
    }
    return runDetail({ id, format: fmt as DetailOpts["format"] })
  }

  return fail(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
