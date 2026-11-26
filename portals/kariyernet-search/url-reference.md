# Kariyer.net URL Reference

Reconnaissance done 2026-11-20 against https://www.kariyer.net (Türkiye's largest general job board). Everything below was read from live pages; re-check it first if the CLI starts returning empty results.

## Access

- `robots.txt` allows `/is-ilanlari` (search) and `/is-ilani/` (posting) for `User-agent: *`. It disallows `/filtre`, `/ozgecmis/*`, `/basvuru-*`, `*?ckw*`, `*?copilot*`, `/*?v=` and the account pages. The CLI uses none of those.
- No login needed for search or posting pages.
- A terms-of-use page could not be located during reconnaissance (the obvious URL 404s). Treat automated access as unsanctioned: personal use, low volume.
- The posting page sometimes answers 403 (WAF) to a plain request and 200 on retry. The CLI does not impersonate a browser: on 403 it exits 1 with code `BLOCKED`.

## Search

`GET https://www.kariyer.net/is-ilanlari[/<city-slug>]?kw=<query>&cp=<page>`

| Part | Meaning |
|------|---------|
| `/<city-slug>` | City filter, lower-case ASCII (`istanbul`, `kocaeli`, `ankara`). Verified: `/is-ilanlari/istanbul` returns only İstanbul listings |
| `kw` | Keywords (URL-encoded Turkish is fine) |
| `cp` | Page number, 1-indexed (pagination links are `cp=1..N`) |

About 53 cards per page. The page is server-rendered (Nuxt): each result is

```
<div data-test="ad-card" time="1 gün" positionName="..." cityName="İstanbul(Avr.)" workModelText="İş Yerinde" ...>
  <a href="/is-ilani/<slug>-<id>" data-test="ad-card-item">
    <span data-test="ad-card-title">…</span>
    <span data-test="subtitle">company</span>
    <span data-test="location">…</span> <span data-test="work-model">…</span>
```

- **id**: trailing digits of the `href`. **date**: only relative (`14 saat`, `1 gün`, `2 hafta`), taken from the `time` attribute and converted to an approximate `YYYY-MM-DD`.
- Sponsored cards share the markup and may repeat an organic id; the parser keeps the first.
- Location strings look like `İstanbul(Avr.)` / `İstanbul(Asya)` (European / Anatolian side) or `İstanbul (Tümü), İzmir`.
- No result total is shown, so phrase-quoting / `OR` behaviour could not be measured (quoted, reversed and `OR` queries all returned a full 53-card page).
- A posting-age filter exists on the site but its parameter was not verified; `--jobage` is applied client-side.

## Posting detail

`GET https://www.kariyer.net/is-ilani/<slug>-<id>` (the URL from a search result).

| Field | Marker |
|-------|--------|
| title | `data-test="job-title"` |
| company | `data-test="company-title"` |
| location | `data-test="company-location"` (includes the district) |
| body | `data-test="qualifications-and-job-description"` (`<p>`/`<ul>` content) |
| candidate criteria | `data-test="alignment-list-title"` / `alignment-list-value` pairs: `Tecrübe`, `Eğitim Seviyesi`, `Yabancı Dil` |
| deadline / published / open flag | `closingDate="DD.MM.YYYY"`, `lastPublishDate="DD.MM.YYYY"`, `isActive="true"` attributes on `div.job-container` |

The only JSON-LD block on the page is a `BreadcrumbList`, not a `JobPosting`, so the parser reads the DOM markers above. A page with neither company nor body (markup change or a bot challenge) makes `detail` exit 1 with `PARSE_FAILED`.
