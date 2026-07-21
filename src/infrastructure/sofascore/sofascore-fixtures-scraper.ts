import { chromium, type BrowserContext, type Page } from "playwright";

import type { AppConfig } from "../../config/app-config.js";
import type { FixtureSnapshot, UpcomingFixture } from "../../domain/fixture.js";
import { kickoffUtcFromDateAndTime } from "../../lib/date.js";
import {
  absoluteMatchUrl,
  buildSofascoreDateUrl,
  buildTeamLogoUrl,
} from "./sofascore-helpers.js";
import type { RawSofascoreFixture } from "./sofascore-types.js";

export class SofascoreFixturesScraper {
  constructor(private readonly config: AppConfig) {}

  async scrapeUpcomingFixtures(dates: string[]): Promise<FixtureSnapshot> {
    const browser = await chromium.launch({ headless: this.config.headless });
    const context = await browser.newContext({
      timezoneId: this.config.browserTimezone,
      locale: this.config.browserLocale,
    });

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeoutMs);

      const fixturesByEventId = new Map<string, UpcomingFixture>();
      const scrapedAtUtc = new Date().toISOString();

      for (const date of dates) {
        const fixturesForDate = await this.scrapeUpcomingFixturesForDate(page, date, scrapedAtUtc);

        for (const fixture of fixturesForDate) {
          fixturesByEventId.set(fixture.sourceEventId, fixture);
        }
      }

      const fixtures = Array.from(fixturesByEventId.values()).sort(compareFixtures);

      return {
        source: "sofascore",
        status: "upcoming",
        scrapedAtUtc,
        datesScraped: dates,
        fixtureCount: fixtures.length,
        fixtures,
        metadata: {
          browserTimezone: "UTC",
          scraperVersion: 1,
        },
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  private async scrapeUpcomingFixturesForDate(
    page: Page,
    date: string,
    scrapedAtUtc: string,
  ): Promise<UpcomingFixture[]> {
    await page.goto(buildSofascoreDateUrl(this.config.baseUrl, date), {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: this.config.timeoutMs }).catch(() => {
      // Sofascore can keep background activity alive; DOM content is enough for this draft.
    });

    await this.acceptConsentIfPresent(page);
    await this.applyUpcomingFilterIfPresent(page);

    const rawFixtures = await page.evaluate<RawSofascoreFixture[], { baseUrl: string }>(
      ({ baseUrl }) => {
        const scheduleCards = Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[class*="event-hl-"]'),
        );

        const sectionNodes = Array.from(
          new Set(scheduleCards.map((card) => card.parentElement).filter(Boolean)),
        ) as HTMLElement[];

        const fixtures: RawSofascoreFixture[] = [];

        for (const sectionNode of sectionNodes) {
          let currentCompetition: string | null = null;
          let currentCountry: string | null = null;

          for (const child of Array.from(sectionNode.children)) {
            if (!(child instanceof HTMLElement)) {
              continue;
            }

            const tournamentLinks = Array.from(
              child.querySelectorAll<HTMLAnchorElement>('a[href*="/football/tournament/"]'),
            )
              .map((anchor) => anchor.textContent?.trim() ?? "")
              .filter(Boolean);

            if (tournamentLinks.length > 0) {
              currentCompetition = tournamentLinks[0] ?? currentCompetition;

              const countryLink = Array.from(
                child.querySelectorAll<HTMLAnchorElement>('a[href^="/football/"]'),
              ).find((anchor) => {
                const href = anchor.getAttribute("href") ?? "";
                const text = anchor.textContent?.trim() ?? "";

                return (
                  text.length > 0 &&
                  !href.includes("/football/tournament/") &&
                  !href.includes("/football/match/")
                );
              });

              currentCountry = countryLink?.textContent?.trim() ?? currentCountry;
              continue;
            }

            if (!child.matches('a[class*="event-hl-"]')) {
              continue;
            }

            const href = child.getAttribute("href") ?? "";
            const className = child.className;
            const eventId =
              className.match(/event-hl-(\d+)/)?.[1] ?? href.match(/#id:(\d+)/)?.[1] ?? null;

            const kickoffTime =
              child
                .querySelector('div[title] bdi[class*="textStyle_body.small"]')
                ?.textContent?.trim() ?? "";

            const scoreMarker =
              child.querySelector('span.score bdi[class*="textStyle_body.small"]')?.textContent?.trim() ?? "";

            const teams = Array.from(
              child.querySelectorAll<HTMLElement>('bdi[class*="textStyle_body.medium"]'),
            )
              .map((node) => node.textContent?.trim() ?? "")
              .filter(Boolean);

            const teamImageUrls = Array.from(
              child.querySelectorAll<HTMLImageElement>('img[src*="/api/v1/team/"]'),
            )
              .map((image) => image.src)
              .filter(Boolean)
              .slice(0, 2);

            const isUpcoming = /^\d{2}:\d{2}$/.test(kickoffTime) && scoreMarker === "-";

            if (!eventId || teams.length < 2 || !isUpcoming) {
              continue;
            }

            fixtures.push({
              eventId,
              kickoffTime,
              competitionName: currentCompetition,
              countryName: currentCountry,
              homeTeamId:
                teamImageUrls[0]?.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
                null,
              homeTeamName: teams[0] ?? null,
              awayTeamId:
                teamImageUrls[1]?.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
                null,
              awayTeamName: teams[1] ?? null,
              href: new URL(href, baseUrl).toString(),
            });
          }
        }

        return fixtures;
      },
      { baseUrl: this.config.baseUrl },
    );

    return rawFixtures.map((fixture) => ({
      source: "sofascore",
      sourceEventId: fixture.eventId,
      scrapeDate: date,
      kickoffAtUtc: kickoffUtcFromDateAndTime(date, fixture.kickoffTime),
      competitionName: fixture.competitionName,
      countryName: fixture.countryName,
      homeTeamId: fixture.homeTeamId,
      homeTeamName: fixture.homeTeamName,
      homeTeamLogoUrl: fixture.homeTeamId ? buildTeamLogoUrl(fixture.homeTeamId) : null,
      awayTeamId: fixture.awayTeamId,
      awayTeamName: fixture.awayTeamName,
      awayTeamLogoUrl: fixture.awayTeamId ? buildTeamLogoUrl(fixture.awayTeamId) : null,
      matchUrl: absoluteMatchUrl(this.config.baseUrl, fixture.href),
      scrapedAtUtc,
    }));
  }

  private async acceptConsentIfPresent(page: Page): Promise<void> {
    const labels = ["Accept", "Accept all", "Consent", "Consentir"];

    for (const label of labels) {
      const button = page.getByRole("button", { name: label });

      if ((await button.count()) === 0) {
        continue;
      }

      await button.first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    }
  }

  private async applyUpcomingFilterIfPresent(page: Page): Promise<void> {
    const button = page.getByRole("button", { name: "Upcoming" });

    if ((await button.count()) === 0) {
      return;
    }

    await button.first().click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
}

function compareFixtures(left: UpcomingFixture, right: UpcomingFixture): number {
  return (
    left.kickoffAtUtc.localeCompare(right.kickoffAtUtc) ||
    compareNullable(left.countryName, right.countryName) ||
    compareNullable(left.competitionName, right.competitionName) ||
    left.homeTeamName.localeCompare(right.homeTeamName) ||
    left.awayTeamName.localeCompare(right.awayTeamName)
  );
}

function compareNullable(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}
