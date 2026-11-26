# kariyernet-cli

Zero-runtime-dependency Bun CLI for searching Kariyer.net (Türkiye). Personal use only, keep volume low.

```bash
bun run src/cli.ts search -q "dış ticaret uzmanı" -l "İstanbul" --format table
bun run src/cli.ts detail https://www.kariyer.net/is-ilani/<slug>-<id> --format plain
```

- Parsing is regex-based over the portal's server-rendered markup (`data-test` anchors); no HTML library is needed.
- `bun install` only pulls dev types (`typescript`, `@types/bun`). Then `bun run typecheck` and `bun test` (network-free).
- Details, flags and output shape: see `../SKILL.md`. Endpoints and markup anchors: `../url-reference.md`.
