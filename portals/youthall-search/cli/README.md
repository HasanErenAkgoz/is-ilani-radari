# youthall-cli

Zero-dependency Bun CLI for searching Youthall (youthall.com, Türkiye). See `../SKILL.md` for usage and `../url-reference.md` for the endpoints and parsing anchors.

```bash
bun install          # dev types only (typescript, @types/bun)
bun run typecheck
bun run test         # network-free: fixtures served over loopback
bun run src/cli.ts search -q "yazılım" --format table
```

Personal use only; keep volume low.
