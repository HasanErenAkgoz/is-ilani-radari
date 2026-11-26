import { BASE_URL, HttpError, htmlFetch, parseJobDetail, stripInvisible, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

const KARIYER_HOST = /(^|\.)kariyer\.net$/i

/**
 * Accept a Kariyer.net posting URL (any kariyer.net host) or a bare slug that
 * ends in the numeric id ("dis-ticaret-uzmani-4588279"). A URL on any other
 * host is rejected, and host/path are read through real URL parsing so
 * look-alike hosts (kariyer.net.evil.io) fall on the reject side.
 * Returns the id and the canonical posting URL, or null.
 */
export function normalizeTarget(input: string): { id: string; url: string } | null {
  const trimmed = input.trim()
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (hasScheme || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    } catch {
      return null
    }
    if (!KARIYER_HOST.test(parsed.hostname)) return null
    const m = parsed.pathname.match(/^\/is-ilani\/([^/]*-(\d{5,}))\/?$/)
    return m ? { id: m[2], url: `${BASE_URL}/is-ilani/${m[1]}` } : null
  }
  const slug = trimmed.match(/^([a-z0-9-]*-(\d{5,}))$/i)
  return slug ? { id: slug[2], url: `${BASE_URL}/is-ilani/${slug[1]}` } : null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const target = normalizeTarget(opts.id)
  if (!target) {
    writeError(
      `Could not parse a Kariyer.net posting from "${opts.id}" - pass the posting URL from a search result (https://www.kariyer.net/is-ilani/<slug>-<id>)`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(target.url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = stripInvisible(parseJobDetail(html, target.id, target.url))

    // A page with neither company nor body is not a parsed posting: either the
    // markup changed or a bot challenge was served. Never report that as success.
    if (job.company === null && job.description === null) {
      writeError(
        "Could not find the posting content in the page (the markup may have changed, or a bot challenge was served instead of the posting)",
        "PARSE_FAILED",
      )
      return 1
    }

    if (opts.format === "plain") {
      const criteriaLines = Object.entries(job.criteria).map(([k, v]) => `${k}: ${v}`)
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.deadline ? `Deadline: ${job.deadline}` : "",
        ...criteriaLines,
        `Status: ${job.isActive ? "ACTIVE (no past deadline found)" : "CLOSED / EXPIRED"}`,
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof HttpError && (e.status === 403 || e.status === 401)) {
      writeError(
        `Kariyer.net refused this client (HTTP ${e.status}) for the posting page. The CLI deliberately does not impersonate a browser; read the posting with WebFetch, or tools/fetch_page.py (which checks robots.txt first), using the URL from the search result.`,
        "BLOCKED",
      )
      return 1
    }
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
