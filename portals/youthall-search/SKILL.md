---
name: youthall-search
version: 1.0.0
description: >
  Use this skill to search Youthall (youthall.com), Türkiye's job board for
  university students, new graduates and young professionals: internships,
  new-graduate roles, management-trainee programs, full-time and part-time
  junior jobs. Invoke when the user wants junior / entry-level / internship
  listings in Türkiye or in a Turkish city (İstanbul, Ankara, İzmir...), or asks
  about a specific Youthall posting. Trigger phrases: youthall, iş ilanı, iş ara,
  staj ilanı, stajyer, yeni mezun iş ilanları, junior iş ilanları, genç
  profesyonel, management trainee, MT programı, tam zamanlı iş, part time iş,
  İstanbul iş ilanları, internship turkey, new graduate jobs turkey, entry level
  jobs istanbul, junior developer jobs turkey.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/youthall-search/cli/src/cli.ts *)
---

# Youthall Search Skill

Search open postings on **Youthall** (youthall.com), Türkiye's youth / early-career job
board. Reads the public, server-rendered listing pages and each posting's schema.org
`JobPosting` data. No authentication, no API key, **zero runtime dependencies** - just `bun`.

Youthall is small (roughly 40-50 open postings across the whole site at any time,
18 per page) and skews to internships, graduate programs and trainee camps, so expect
few hits for specific titles such as "Frontend Developer"; broad Turkish terms like
`yazılım` or `developer` work better.

## ⚠️ Personal use only

robots.txt allows the listing pages and the `?query` / `?page` parameters (checked
2026-11-13), and the user agreement's bulk-extraction clauses target Youthall's own AI
tools and commercial reuse. Still: **keep volume low** (a handful of requests per run), do
not use it commercially or for bulk data collection, and run it on your own responsibility.

## Commands

### Search job listings

```bash
bun run .agents/skills/youthall-search/cli/src/cli.ts search [flags]
```

Query syntax: not verified - Youthall reports no result total, so phrase quoting and OR could not be measured; pass plain words.

Key flags:
- `--query <text>` / `-q <text>` - keywords, sent to Youthall's own search box. Optional; omit to list every open posting.
- `--location <city>` / `-l <city>` - a Turkish city, e.g. `"İstanbul"`. **Without `--query`** it opens Youthall's city page (`/tr/is-ilanlari/istanbul/`). **With `--query`** Youthall returns nothing for a city page + keyword, so the CLI searches the hub and keeps only cards whose location names that city (cards tagged just `Hibrit` are then dropped).
- `--type <facet>` / `-t <facet>` - `stajyer`, `yeni-mezun`, `tam-zamanli`, `part-time`, `management-trainee`, `genc-profesyonel`, `sozlesmeli`, `proje-bazli`, `freelance`, `gonullu`. Combines with `--location` (`/istanbul-tam-zamanli/`) but **not** with `--query` (the CLI refuses that combination instead of returning a silently empty list).
- `--jobage <days>` - posted within N days. The listing card carries only the **deadline**, so this fetches each result's detail page for its publication date (one request per result, capped at 20). Results whose date cannot be read are kept with `date: null`.
- `--page <n>` - 1-indexed page (18 results per page).
- `--limit <n>` / `-n <n>` - cap results emitted (client-side).
- `--format json|table|plain` - default `json`.

Each result: `id`, `title`, `company`, `location`, `date` (publication date, `null` unless `--jobage` filled it), `deadline` (application deadline from the card), `type` (Youthall's label, e.g. "Tam Zamanlı"), `snippet`, `url`.

### Fetch full job detail

```bash
bun run .agents/skills/youthall-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is `<company-slug>/<posting-slug>` from search results (e.g. `Commencis/commencis-cloud-camp-2027_50`), or a full `https://www.youthall.com/tr/...` posting URL. Returns description, publication date, deadline, employment type (`full_time`, `part_time`, `internship`, `contract`, ...), and locations.

## Usage examples

```bash
# Software-related postings anywhere in Türkiye
bun run .agents/skills/youthall-search/cli/src/cli.ts search -q "yazılım" --format table

# Full-time roles in İstanbul
bun run .agents/skills/youthall-search/cli/src/cli.ts search -l "İstanbul" -t tam-zamanli --format table

# New-graduate roles anywhere
bun run .agents/skills/youthall-search/cli/src/cli.ts search -t yeni-mezun --format table

# Developer postings in İstanbul from the last 14 days
bun run .agents/skills/youthall-search/cli/src/cli.ts search -q developer -l "İstanbul" --jobage 14 --format table

# Full description of one posting
bun run .agents/skills/youthall-search/cli/src/cli.ts detail Commencis/commencis-cloud-camp-2027_50 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default - programmatic use (`/scrape`), passing ids to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading one posting's full detail |

All errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Notes

- Youthall's `?city[]=` / `?type[]=` form parameters return zero rows when requested directly; only the path facets work. See `url-reference.md`.
- A posting listed in all 81 provinces shows `location: "Tüm Türkiye"`; a remote posting (`jobLocationType: TELECOMMUTE`) shows `"Uzaktan"`.
- Postings disappear after their deadline (Youthall does not keep expired pages), so `detail` on an old id returns `NOT_FOUND`.
- Many listings are training camps or programs rather than jobs; read `type` and the description before treating one as a vacancy.
