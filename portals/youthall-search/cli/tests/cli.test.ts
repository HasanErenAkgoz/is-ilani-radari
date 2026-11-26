import { describe, expect, test } from "bun:test"
import { join } from "path"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { parseJSON, runCLI, type CLIResult } from "./helpers"

/**
 * Run the real CLI with fetch redirected to a loopback server that serves the
 * saved fixture. Any request other than the expected Youthall URL throws, so
 * the suite never touches the live portal.
 */
async function runWithFixture(args: string[], fixture: string, expectPath: string): Promise<{ result: CLIResult; requests: URL[] }> {
  const requests: URL[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push(new URL(request.url))
      return new Response(await Bun.file(join(import.meta.dir, "fixtures", fixture)).text(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    },
  })
  const dir = mkdtempSync(join(tmpdir(), "youthall-cli-"))
  const preload = join(dir, "fetch.ts")
  writeFileSync(
    preload,
    `
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== "https://www.youthall.com" || url.pathname !== ${JSON.stringify(expectPath)}) {
        throw new Error("Unexpected request " + url.href);
      }
      return originalFetch(${JSON.stringify(server.url.origin)} + url.pathname + url.search, init);
    };
  `,
  )
  const CLI = join(import.meta.dir, "../src/cli.ts")
  try {
    const proc = Bun.spawn(["bun", "run", "--preload", preload, CLI, ...args], { stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { result: { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }, requests }
  } finally {
    server.stop(true)
    rmSync(dir, { recursive: true, force: true })
  }
}

interface SearchOut {
  meta: { count: number; page: number }
  results: { id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }[]
}

describe("search (offline fixture)", () => {
  test("returns the contract shape with real ids and urls", async () => {
    const { result, requests } = await runWithFixture(["search", "-q", "yazılım", "--limit", "3"], "search-yazilim.html", "/tr/is-ilanlari/")
    const out = parseJSON<SearchOut>(result)
    expect(out.meta).toEqual({ count: 3, page: 1 })
    expect(out.results[0].id).toBe("code2work/veri-bilimci-ve-yazilimci-yetistirme-programi_12")
    expect(out.results[1].url).toBe("https://www.youthall.com/tr/LogoYazilim/log-in-winter-staj-programi_34/")
    for (const r of out.results) for (const k of ["id", "title", "company", "location", "date", "url"]) expect(k in r).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0].searchParams.get("query")).toBe("yazılım")
  })

  test("query + location filters client-side", async () => {
    const { result } = await runWithFixture(["search", "-q", "yazılım", "-l", "Konya"], "search-yazilim.html", "/tr/is-ilanlari/")
    const out = parseJSON<SearchOut>(result)
    expect(out.results.map((r) => r.company)).toEqual(["Aselsan Konya"])
  })
})

describe("detail (offline fixture)", () => {
  test("parses the JSON-LD posting", async () => {
    const { result } = await runWithFixture(
      ["detail", "workintech/aranan-meslekler-ai-developer-ve-data-scientist-workintech-te_9"],
      "detail-workintech.html",
      "/tr/workintech/aranan-meslekler-ai-developer-ve-data-scientist-workintech-te_9/",
    )
    const job = parseJSON<{ company: string; date: string; deadline: string }>(result)
    expect(job).toMatchObject({ company: "Workintech", date: "2026-10-21", deadline: "2026-11-26" })
  })
})

describe("argument validation (no network)", () => {
  const errorOf = (r: CLIResult) => JSON.parse(r.stderr) as { error: string; code: string }

  test("unknown flag exits 1 with JSON error on stderr", async () => {
    const r = await runCLI(["search", "--bogus", "x"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(errorOf(r).code).toBe("UNKNOWN_FLAG")
  })

  test("detail without id", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(errorOf(r).code).toBe("NO_ID")
  })

  test("detail rejects non-youthall URLs", async () => {
    const r = await runCLI(["detail", "https://evil.example/tr/a/b/"])
    expect(r.exitCode).toBe(1)
    expect(errorOf(r).code).toBe("BAD_ID")
  })

  test("--type with --query is refused, not silently empty", async () => {
    const r = await runCLI(["search", "-q", "x", "-t", "stajyer"])
    expect(r.exitCode).toBe(1)
    expect(errorOf(r).code).toBe("CONFLICTING_FLAGS")
  })

  test("bad --type, empty --query, fractional --jobage", async () => {
    expect(errorOf(await runCLI(["search", "-t", "nope"])).code).toBe("BAD_ARG")
    expect(errorOf(await runCLI(["search", "-q", ""])).code).toBe("BAD_ARG")
    expect(errorOf(await runCLI(["search", "--jobage", "0.5"])).code).toBe("BAD_ARG")
  })
})
