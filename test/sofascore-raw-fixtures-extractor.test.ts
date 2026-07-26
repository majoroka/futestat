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
      competitionId: "325",
      competitionName: "Brasileirão Betano",
      competitionLogoUrl: "https://img.sofascore.com/api/v1/unique-tournament/325/image",
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
      competitionId: "480",
      competitionName: "CONMEBOL Sudamericana, Knockout stage",
      competitionLogoUrl: "https://img.sofascore.com/api/v1/unique-tournament/480/image",
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

test("extractRawFixturesFromPage supports competition pages with implicit today rows", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(
      `
        <div>
          <div class="d_flex ai_center py_xs">
            <a href="/football/tournament/denmark/superliga/39">Danish Superliga</a>
            <a href="/football/denmark">Denmark</a>
            <img src="https://img.sofascore.com/api/v1/unique-tournament/39/image/dark" />
          </div>
          <a class="event-hl-1 d_block" href="/football/match/a-b/abc#id:1">
            <bdi class="textStyle_body.small">25/07/26</bdi>
            <bdi class="textStyle_body.small">FT</bdi>
            <span class="score">1</span>
            <span class="score">0</span>
            <img src="https://img.sofascore.com/api/v1/team/11/image/small" />
            <img src="https://img.sofascore.com/api/v1/team/12/image/small" />
            <bdi class="textStyle_body.medium">Team A</bdi>
            <bdi class="textStyle_body.medium">Team B</bdi>
          </a>
          <a class="event-hl-2 d_block" href="/football/match/c-d/def#id:2">
            <bdi class="textStyle_body.small">13:00</bdi>
            <bdi class="textStyle_body.small">-</bdi>
            <img src="https://img.sofascore.com/api/v1/team/21/image/small" />
            <img src="https://img.sofascore.com/api/v1/team/22/image/small" />
            <bdi class="textStyle_body.medium">Team C</bdi>
            <bdi class="textStyle_body.medium">Team D</bdi>
          </a>
          <a class="event-hl-3 d_block" href="/football/match/e-f/ghi#id:3">
            <bdi class="textStyle_body.small">27/07/26</bdi>
            <bdi class="textStyle_body.small">18:00</bdi>
            <img src="https://img.sofascore.com/api/v1/team/31/image/small" />
            <img src="https://img.sofascore.com/api/v1/team/32/image/small" />
            <bdi class="textStyle_body.medium">Team E</bdi>
            <bdi class="textStyle_body.medium">Team F</bdi>
          </a>
        </div>
      `,
      { waitUntil: "domcontentloaded" },
    );

    const fixtures = await extractRawFixturesFromPage(page, {
      baseUrl: "https://www.sofascore.com",
      date: "2026-07-26",
      mode: "competition",
    });

    assert.deepEqual(
      fixtures.map((fixture) => ({
        eventId: fixture.eventId,
        matchDate: fixture.matchDate,
        status: fixture.status,
        competitionId: fixture.competitionId,
        countryName: fixture.countryName,
      })),
      [
        {
          eventId: "1",
          matchDate: "2026-07-25",
          status: "finished",
          competitionId: "39",
          countryName: "Denmark",
        },
        {
          eventId: "2",
          matchDate: "2026-07-26",
          status: "upcoming",
          competitionId: "39",
          countryName: "Denmark",
        },
        {
          eventId: "3",
          matchDate: "2026-07-27",
          status: "upcoming",
          competitionId: "39",
          countryName: "Denmark",
        },
      ],
    );
  } finally {
    await page.close();
    await browser.close();
  }
});
