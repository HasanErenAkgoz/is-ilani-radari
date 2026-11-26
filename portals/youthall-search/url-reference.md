# Youthall - URL & parsing reference

Reconnaissance date: 2026-11-13. Update this file when Youthall changes its markup.

## Access

- `robots.txt`: `User-agent: *` → `Allow: /`; disallowed only tracking params (`?v331`, `?hl`, `?trk`), `/crm*`, password-reset and email-verification paths. The file explicitly states that listing filter params (`?city`, `?type`, `?query`, ...) are **not** disallowed.
- No login needed for listings or posting pages.
- `llms.txt` documents the public URL patterns (`/tr/is-ilanlari/{kategori}/`, `/tr/is-ilanlari/{sehir}/`, `/tr/is-ilanlari/{sehir}-{kategori}/`).
- User-Agent used: `Mozilla/5.0 (compatible; youthall-cli/1.0)` - accepted (HTTP 200).

## Search

`GET https://www.youthall.com/tr/is-ilanlari/[<facet>/]?query=<q>&page=<n>`

| Parameter | Where | Notes |
|-----------|-------|-------|
| `query` | query string | Keyword search. Works only on the hub (`/tr/is-ilanlari/`); combined with a facet path it returns 0 rows. |
| `page` | query string | 1-indexed; 18 cards per page. Pagination links: `href="/tr/is-ilanlari/?page=2"`. |
| `order` | query string | `1` newest first (default), `2` oldest first, `3` closest deadline. Not exposed by the CLI. |
| city facet | path | `istanbul`, `ankara`, `kocaeli`, ... (ASCII-folded, lowercase). |
| type facet | path | `stajyer`, `yeni-mezun`, `tam-zamanli`, `part-time`, `management-trainee`, `genc-profesyonel`, `sozlesmeli`, `proje-bazli`, `freelance`, `gonullu`. |
| city+type | path | `istanbul-tam-zamanli`. |
| `city[]`, `type[]`, `department[]`, `careerLevel[]`, `employee[]` | query string | Present in the filter form (`<form id="filter" method="GET">`), but a direct request with them returned **0 rows** (2026-11-13). Not used. |

No result total is printed on the page.

### Card markup (parsed)

The page renders each posting twice: grid view (`#internshipsGrid`, `.jobs`) and list view (`#internshipsList`, `.jobs-row`). Only the list view has the company name, so the parser splits on `<div class="jobs-row">` after `id="internshipsList"`.

| Field | Anchor |
|-------|--------|
| url / id | `<a href="https://www.youthall.com/tr/<company>/<slug>/" class="jobs-row__link">` → id `<company>/<slug>` |
| company | `<span class="jobs-row__company">` |
| title | `<div class="jobs-row__title"> ... <h5>` |
| snippet | `<div class="jobs-row__desc">` |
| type | `.jobs-tag` with `<i class="fas fa-briefcase">` (e.g. `Tam Zamanlı`, `Serbest Zamanlı`) |
| deadline | `.jobs-tag` with `<i class="far fa-clock">`, `DD.MM.YYYY` - matches the posting's `validThrough` |
| location | `.jobs-tag` with `<i class="fas fa-map-marker-alt">` (`İstanbul`, `İstanbul +`, `Hibrit`, ...) |

Empty result: `<div class="c-jobs-empty ...">` and no `.jobs-row`.

## Detail

`GET https://www.youthall.com/tr/<company>/<slug>/`

Parsed from `<script type="application/ld+json">` with `"@type": "JobPosting"`:

| JSON-LD | Output |
|---------|--------|
| `title` | `title` |
| `hiringOrganization.name` | `company` |
| `datePosted` | `date` |
| `validThrough` | `deadline` (date part) |
| `employmentType` (`FULL_TIME`, `PART_TIME`, `CONTRACTOR`, `INTERN`, ...) | `employmentType` (`full_time`, `part_time`, `contract`, `internship`, ...) |
| `jobLocation[].address.addressLocality` | `locations`, summarised in `location` (81 cities → `Tüm Türkiye`) |
| `jobLocationType: TELECOMMUTE` | `location: "Uzaktan"` |
| `description` (HTML) | `description` (visible text, line breaks kept) |
| `directApply` | `directApply` |

Expired postings: not served (404 → `NOT_FOUND`).
