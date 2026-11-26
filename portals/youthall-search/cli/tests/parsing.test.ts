import { describe, expect, test } from "bun:test"
import { join } from "path"
import {
  citySlug,
  lastPage,
  normalizeId,
  parseJobCards,
  parseJobDetail,
  stripInvisible,
  trDateToIso,
} from "../src/helpers"
import { buildUrl, matchesLocation } from "../src/commands/search"

const fixture = (name: string) => Bun.file(join(import.meta.dir, "fixtures", name)).text()

describe("parseJobCards (live capture, ?query=yazılım)", () => {
  test("parses every list-view card with id, title, company, location, deadline", async () => {
    const cards = parseJobCards(await fixture("search-yazilim.html"))
    expect(cards).toHaveLength(5)
    expect(cards[0]).toEqual({
      id: "code2work/veri-bilimci-ve-yazilimci-yetistirme-programi_12",
      title: expect.stringContaining("Veri Bilimci ve Yazılımcı"),
      company: "Code2Work",
      location: "Hibrit",
      date: null,
      deadline: "2026-12-10",
      type: expect.any(String),
      snippet: expect.any(String),
      url: "https://www.youthall.com/tr/code2work/veri-bilimci-ve-yazilimci-yetistirme-programi_12/",
    })
    expect(cards.map((c) => c.company)).toEqual(["Code2Work", "Logo Yazılım", "Aselsan Konya", "YGA", "Commencis"])
    for (const c of cards) {
      expect(c.title).not.toMatch(/<|&amp;|&#/)
      expect(c.url.startsWith("https://www.youthall.com/tr/")).toBe(true)
    }
  })

  test("one malformed card does not break the rest", async () => {
    const html = await fixture("search-yazilim.html")
    const broken = html.replace('<span class="jobs-row__company">Code2Work</span>', "").replace(/<h5>Veri Bilimci[\s\S]*?<\/h5>/, "<h5></h5>")
    const cards = parseJobCards(broken)
    expect(cards).toHaveLength(4)
    expect(cards[0].company).toBe("Logo Yazılım")
  })

  test("empty result page yields no cards", () => {
    expect(parseJobCards('<div class="c-view-list u-gap-bottom-25" id="internshipsList"></div>')).toEqual([])
  })
})

describe("parseJobDetail (live capture, JSON-LD)", () => {
  test("reads title, company, dates, employment type and readable description", async () => {
    const job = parseJobDetail(await fixture("detail-workintech.html"), "workintech/x_9")!
    expect(job.title).toBe("Aranan meslekler AI Developer ve Data Scientist Workintech’te")
    expect(job.company).toBe("Workintech")
    expect(job.date).toBe("2026-10-21")
    expect(job.deadline).toBe("2026-11-26")
    expect(job.employmentType).toBe("contract")
    expect(job.description).toContain("Sevgili Youthall kullanıcıları")
    expect(job.description).not.toMatch(/<\/?[a-z]+>/i)
    expect(job.location).toBe("Uzaktan")
  })

  test("returns null when the page has no JobPosting block", () => {
    expect(parseJobDetail("<html><body>nope</body></html>", "a/b")).toBeNull()
  })
})

describe("helpers", () => {
  test("trDateToIso", () => {
    expect(trDateToIso("26.11.2026")).toBe("2026-11-26")
    expect(trDateToIso("1.2.2027")).toBe("2027-02-01")
    expect(trDateToIso("yarın")).toBeNull()
  })

  test("normalizeId accepts ids and youthall URLs, rejects other hosts and non-posting pages", () => {
    expect(normalizeId("Commencis/commencis-cloud-camp-2027_50")).toBe("Commencis/commencis-cloud-camp-2027_50")
    expect(normalizeId("https://www.youthall.com/tr/Commencis/commencis-cloud-camp-2027_50/")).toBe("Commencis/commencis-cloud-camp-2027_50")
    expect(normalizeId("youthall.com/en/yeo/purchasing-specialist_15")).toBe("yeo/purchasing-specialist_15")
    expect(normalizeId("https://youthall.com.evil.io/tr/a/b/")).toBeNull()
    expect(normalizeId("https://www.youthall.com@evil.io/tr/a/b/")).toBeNull()
    expect(normalizeId("https://www.youthall.com/tr/is-ilanlari/istanbul/")).toBeNull()
    expect(normalizeId("is-ilanlari/istanbul")).toBeNull()
  })

  test("citySlug folds Turkish letters", () => {
    expect(citySlug("İstanbul")).toBe("istanbul")
    expect(citySlug("Tekirdağ")).toBe("tekirdag")
  })

  test("lastPage reads the pagination links", () => {
    expect(lastPage('<a href="/tr/is-ilanlari/?page=2"></a><a href="/tr/is-ilanlari/?page=3"></a>')).toBe(3)
    expect(lastPage("<div></div>")).toBe(1)
  })

  test("stripInvisible removes zero-width and tag characters", () => {
    expect(stripInvisible({ t: "a​b\u{E0041}c" })).toEqual({ t: "abc" })
  })
})

describe("buildUrl", () => {
  test("keyword search uses the hub with ?query", () => {
    expect(buildUrl({ query: "yazılım", page: 1, format: "json" })).toBe(
      "https://www.youthall.com/tr/is-ilanlari/?query=yaz%C4%B1l%C4%B1m",
    )
  })
  test("city and type use Youthall's path facets", () => {
    expect(buildUrl({ location: "İstanbul", type: "tam-zamanli", page: 2, format: "json" })).toBe(
      "https://www.youthall.com/tr/is-ilanlari/istanbul-tam-zamanli/?page=2",
    )
  })
  test("query + location keeps the hub and filters client-side", () => {
    expect(buildUrl({ query: "developer", location: "İstanbul", page: 1, format: "json" })).toBe(
      "https://www.youthall.com/tr/is-ilanlari/?query=developer",
    )
    const card = { id: "a/b", title: "t", company: null, location: "İstanbul +", date: null, deadline: null, type: null, snippet: null, url: "" }
    expect(matchesLocation(card, "istanbul")).toBe(true)
    expect(matchesLocation({ ...card, location: "Hibrit" }, "İstanbul")).toBe(false)
  })
})
