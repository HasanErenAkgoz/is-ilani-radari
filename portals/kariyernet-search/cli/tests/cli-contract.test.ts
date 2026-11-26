import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers"

// Network-free: every case below fails argument validation before any request is made.

function errorOf(stderr: string): { error: string; code: string } {
  return JSON.parse(stderr.split("\n")[0])
}

describe("CLI error contract (stderr JSON, exit 1)", () => {
  test("unknown flag", async () => {
    const r = await runCLI(["search", "-q", "depo", "--bogus"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(errorOf(r.stderr).code).toBe("UNKNOWN_FLAG")
  })

  test("search needs a non-empty query", async () => {
    for (const args of [["search"], ["search", "-q"], ["search", "-q", ""]]) {
      const r = await runCLI(args)
      expect(r.exitCode).toBe(1)
      expect(errorOf(r.stderr).code).toBe("BAD_ARG")
    }
  })

  test("bad numeric flags and format", async () => {
    for (const extra of [["--jobage", "0"], ["--page", "x"], ["--limit", "1.5"], ["--format", "xml"]]) {
      const r = await runCLI(["search", "-q", "depo", ...extra])
      expect(r.exitCode).toBe(1)
      expect(errorOf(r.stderr).code).toBe("BAD_ARG")
    }
  })

  test("detail needs a Kariyer.net posting", async () => {
    const none = await runCLI(["detail"])
    expect(none.exitCode).toBe(1)
    expect(errorOf(none.stderr).code).toBe("NO_ID")

    const foreign = await runCLI(["detail", "https://example.com/is-ilani/x-1234567"])
    expect(foreign.exitCode).toBe(1)
    expect(errorOf(foreign.stderr).code).toBe("BAD_ID")
  })

  test("unknown command", async () => {
    const r = await runCLI(["nope"])
    expect(r.exitCode).toBe(1)
    expect(errorOf(r.stderr).code).toBe("BAD_CMD")
  })
})
