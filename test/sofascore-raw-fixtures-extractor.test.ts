import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { extractRawFixturesFromPage } from "../src/infrastructure/sofascore/sofascore-raw-fixtures-extractor.js";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sofascore-pages");

test("extractRawFixturesFromPage parses a mixed finished/upcoming Sofascore day snapshot", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const html = readFileSync(path.join(fixturesDir, "2026-07-23.html"), "utf8");
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const fixtures = await extractRawFixturesFromPage(page, {
      baseUrl: "https://www.sofascore.com",
      date: "2026-07-23",
    });

    const statuses = fixtures.reduce<Record<string, number>>((acc, fixture) => {
      acc[fixture.status] = (acc[fixture.status] ?? 0) + 1;
      return acc;
    }, {});

    assert.equal(fixtures.length, 77);
    assert.equal(statuses.finished, 20);
    assert.equal(statuses.upcoming, 57);

    const flamengo = fixtures.find((fixture) => fixture.eventId === "15237984");
    assert.deepEqual(flamengo, {
      eventId: "15237984",
      matchDate: "2026-07-23",
      kickoffTime: "00:30",
      competitionName: "Brasileirão Betano",
      countryName: "Brazil",
      homeTeamId: "21845",
      homeTeamName: "Chapecoense",
      homeTeamLogoUrl: "https://img.sofascore.com/api/v1/team/21845/image/small",
      awayTeamId: "5981",
      awayTeamName: "Flamengo",
      awayTeamLogoUrl: "https://img.sofascore.com/api/v1/team/5981/image/small",
      status: "finished",
      resultLabel: "FT",
      homeScore: 0,
      awayScore: 4,
      href: "https://www.sofascore.com/football/match/chapecoense-flamengo/GucsVLi#id:15237984",
    });
  } finally {
    await page.close();
    await browser.close();
  }
});

test("extractRawFixturesFromPage parses a future Sofascore day snapshot including postponed games", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const html = readFileSync(path.join(fixturesDir, "2026-07-24.html"), "utf8");
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const fixtures = await extractRawFixturesFromPage(page, {
      baseUrl: "https://www.sofascore.com",
      date: "2026-07-24",
    });

    const statuses = fixtures.reduce<Record<string, number>>((acc, fixture) => {
      acc[fixture.status] = (acc[fixture.status] ?? 0) + 1;
      return acc;
    }, {});

    assert.equal(fixtures.length, 13);
    assert.equal(statuses.upcoming, 12);
    assert.equal(statuses.postponed, 1);

    const boca = fixtures.find((fixture) => fixture.eventId === "16251101");
    assert.deepEqual(boca, {
      eventId: "16251101",
      matchDate: "2026-07-24",
      kickoffTime: "00:30",
      competitionName: "CONMEBOL Sudamericana, Knockout stage",
      countryName: "South America",
      homeTeamId: "3202",
      homeTeamName: "Boca Juniors",
      homeTeamLogoUrl: "https://img.sofascore.com/api/v1/team/3202/image/small",
      awayTeamId: "3163",
      awayTeamName: "O'Higgins",
      awayTeamLogoUrl: "https://img.sofascore.com/api/v1/team/3163/image/small",
      status: "upcoming",
      resultLabel: null,
      homeScore: null,
      awayScore: null,
      href: "https://www.sofascore.com/football/match/boca-juniors-ohiggins/nnbscob#id:16251101",
    });
  } finally {
    await page.close();
    await browser.close();
  }
});
