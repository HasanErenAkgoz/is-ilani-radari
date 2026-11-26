# Youthall fixtures

Captured 2026-11-13 with `curl -A "Mozilla/5.0 (compatible; youthall-cli/1.0)"` during `/add-portal` reconnaissance.

- `search-yazilim.html` - verbatim slice of `https://www.youthall.com/tr/is-ilanlari/?query=yaz%C4%B1l%C4%B1m`, from `<div class="c-view-list u-gap-bottom-25"` up to (not including) `<div class="c-filter-panel"`: the list-view cards only. Full-page SHA-256: `050dfa07401e9aff6b5904f8dc927b510d892abb9af6e48e349162423ae54820`.
- `detail-workintech.html` - the `application/ld+json` script blocks, verbatim, from `https://www.youthall.com/tr/workintech/aranan-meslekler-ai-developer-ve-data-scientist-workintech-te_9/`. Full-page SHA-256: `16c45249425e25da59aa84d5cc7789340d56e2dcb5fb0b36c0f33630c328d4be`.

Tests serve these over loopback and reject any other request; they never contact youthall.com.
