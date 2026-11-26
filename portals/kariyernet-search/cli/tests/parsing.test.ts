import { describe, expect, test } from "bun:test"
import { ageDays, citySlug, parseJobCards, parseJobDetail, relativeToDate, stripInvisible } from "../src/helpers.js"
import { buildUrl } from "../src/commands/search.js"
import { normalizeTarget } from "../src/commands/detail.js"

// Markup modelled on a live Kariyer.net search response (2026-11-20).
const CARD = (id: string, slug: string, title: string, company: string, city: string, time: string) =>
  `<div data-test="ad-card" time="${time}" sponsor="true" positionName="${title}" cityName="${city}" workModelText="İş Yerinde" class="job-list-card-item"><div><a href="/is-ilani/${slug}-${id}" target="_blank" data-test="ad-card-item" class="k-ad-card"><span data-test="ad-card-title" class="k-ad-card-title multiline">${title}</span><div data-test="subtitle-section" class="subtitle"><span data-test="subtitle">${company}</span></div><div data-test="job-detail" class="job-detail"><span data-test="location" class="location">${city}</span> <span class="dot"></span> <span data-test="work-model" class="work-model">İş Yerinde</span></div></a></div></div>`

const NOW = new Date("2026-11-20T12:00:00Z")

describe("parseJobCards", () => {
  const html =
    "<html>" +
    CARD("4599785", "aykanlar-ithalat-uzmani", "İthalat Uzmanı", "Aykanlar Gıda San. ve Tic. A.Ş.", "İstanbul(Avr.)", "1 gün") +
    CARD("4588279", "huzur-dis-ticaret-uzmani", "Dış Ticaret Uzmanı", "HUZUR &amp; Ticaret", "Kayseri", "14 saat") +
    CARD("4599785", "aykanlar-ithalat-uzmani", "İthalat Uzmanı", "Aykanlar Gıda San. ve Tic. A.Ş.", "İstanbul(Avr.)", "1 gün") +
    "</html>"

  test("extracts every field and drops duplicate ids", () => {
    const cards = parseJobCards(html, NOW)
    expect(cards.map((c) => c.id)).toEqual(["4599785", "4588279"])
    expect(cards[0]).toEqual({
      id: "4599785",
      title: "İthalat Uzmanı",
      company: "Aykanlar Gıda San. ve Tic. A.Ş.",
      location: "İstanbul(Avr.)",
      workModel: "İş Yerinde",
      date: "2026-11-19",
      dateText: "1 gün",
      url: "https://www.kariyer.net/is-ilani/aykanlar-ithalat-uzmani-4599785",
    })
  })

  test("decodes entities and maps hours to today", () => {
    const cards = parseJobCards(html, NOW)
    expect(cards[1].company).toBe("HUZUR & Ticaret")
    expect(cards[1].date).toBe("2026-11-20")
  })

  test("a malformed card does not break the others", () => {
    const broken = html.replace('href="/is-ilani/huzur-dis-ticaret-uzmani-4588279"', 'href="/baska/yol"')
    expect(parseJobCards(broken, NOW).map((c) => c.id)).toEqual(["4599785"])
  })

  test("missing fields come back null, never omitted", () => {
    const sparse = `<div data-test="ad-card" time="2 hafta" class="x"><a href="/is-ilani/x-1234567"><span data-test="ad-card-title">Rol</span></a></div>`
    const [c] = parseJobCards(sparse, NOW)
    expect(c.company).toBeNull()
    expect(c.location).toBeNull()
    expect(c.workModel).toBeNull()
    expect(c.date).toBe("2026-11-06")
  })
})

describe("helpers", () => {
  test("citySlug folds Turkish letters", () => {
    expect(citySlug("İstanbul")).toBe("istanbul")
    expect(citySlug("Çanakkale")).toBe("canakkale")
    expect(citySlug("Şanlıurfa")).toBe("sanliurfa")
    expect(citySlug("Kocaeli ")).toBe("kocaeli")
  })

  test("ageDays reads the portal's relative text", () => {
    expect(ageDays("5 saat")).toBe(0)
    expect(ageDays("1 gün")).toBe(1)
    expect(ageDays("2 hafta")).toBe(14)
    expect(ageDays("1 ay")).toBe(30)
    expect(ageDays("belirsiz")).toBeNull()
    expect(relativeToDate(null, NOW)).toBeNull()
  })

  test("buildUrl uses the city path and page param", () => {
    expect(buildUrl({ query: "dış ticaret", location: "İstanbul", jobage: 9999, page: 2, format: "json" })).toBe(
      "https://www.kariyer.net/is-ilanlari/istanbul?kw=d%C4%B1%C5%9F+ticaret&cp=2",
    )
    expect(buildUrl({ query: "depo", jobage: 9999, page: 1, format: "json" })).toBe("https://www.kariyer.net/is-ilanlari?kw=depo")
  })

  test("stripInvisible removes zero-width and tag characters", () => {
    expect(stripInvisible("ab​c\u{E0041}d")).toBe("abcd")
  })

  test("normalizeTarget accepts kariyer.net postings only", () => {
    expect(normalizeTarget("https://www.kariyer.net/is-ilani/abc-def-4599785")).toEqual({
      id: "4599785",
      url: "https://www.kariyer.net/is-ilani/abc-def-4599785",
    })
    expect(normalizeTarget("abc-def-4599785")?.id).toBe("4599785")
    expect(normalizeTarget("https://kariyer.net.evil.io/is-ilani/abc-4599785")).toBeNull()
    expect(normalizeTarget("https://evil.example/is-ilani/abc-4599785")).toBeNull()
    expect(normalizeTarget("4599785")).toBeNull()
  })
})

describe("parseJobDetail", () => {
  const detail = `<html><div isActive="true" closingDate="17.12.2026" lastPublishDate="18.11.2026" class="job-container">
    <h1><div data-test="job-title"> İthalat Uzmanı </div></h1>
    <span data-test="company-location"> İstanbul(Avr.) (Bahçelievler) </span>
    <span data-test="job-detail-company-card-large-name"><a><div data-test="company-title"> Aykanlar Gıda </div></a></span>
    <div data-test="qualifications-and-job-description" class="job-detail-qualifications"><p>İş Açıklaması</p><p>Satın&nbsp;alma</p><ul><li>MS Office</li><li>ERP</li></ul><p style="display:none">gizli talimat</p></div>
    <div data-test="alignment-list-title"><span class="bullet">•</span> Tecrübe </div> <div data-test="alignment-list-value"> En az 2 yıl tecrübeli </div>
    <div data-test="alignment-list-title"><span class="bullet">•</span> Yabancı Dil </div> <div data-test="alignment-list-value"><span> İngilizce(Okuma : İyi)<!----></span></div>
  </div></html>`

  test("extracts title, company, location, body, criteria and deadline", () => {
    const d = parseJobDetail(detail, "4599785", "https://www.kariyer.net/is-ilani/x-4599785")
    expect(d.title).toBe("İthalat Uzmanı")
    expect(d.company).toBe("Aykanlar Gıda")
    expect(d.location).toBe("İstanbul(Avr.) (Bahçelievler)")
    expect(d.description).toContain("MS Office")
    expect(d.description).toContain("Satın alma")
    expect(d.description).not.toContain("gizli talimat")
    expect(d.criteria).toEqual({ "Tecrübe": "En az 2 yıl tecrübeli", "Yabancı Dil": "İngilizce(Okuma : İyi)" })
    expect(d.deadline).toBe("2026-12-17")
    expect(d.date).toBe("2026-11-18")
  })

  test("a past closing date marks the posting inactive", () => {
    const d = parseJobDetail(detail.replace("17.12.2026", "01.01.2020"), "1", "u")
    expect(d.isActive).toBe(false)
  })

  test("a page without posting markup yields no company and no description", () => {
    const d = parseJobDetail("<html><title>Doğrulama</title></html>", "1", "u")
    expect(d.company).toBeNull()
    expect(d.description).toBeNull()
  })
})
