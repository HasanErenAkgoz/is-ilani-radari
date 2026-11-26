import { htmlFetch, normalizeId, parseJobDetail, postingUrl, stripInvisible, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(
      `Could not parse a Youthall posting id from "${opts.id}" (expected "<company>/<posting>" or a youthall.com posting URL)`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(postingUrl(id))
    if (!html) {
      writeError("Posting not found (it may have expired; Youthall removes postings after their deadline)", "NOT_FOUND")
      return 1
    }
    const parsed = parseJobDetail(html, id)
    if (!parsed) {
      writeError("No JobPosting data on that page - not a posting, or Youthall changed its markup (see url-reference.md)", "PARSE_FAILED")
      return 1
    }
    const job = stripInvisible(parsed)
    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.deadline ? `Deadline: ${job.deadline}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
