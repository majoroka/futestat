import { chromium, type Page } from "playwright";

import type { AppConfig } from "../../config/app-config.js";
import type { ScrapedFixture, ScrapedFixtureDay } from "../../domain/fixture.js";
import { kickoffUtcFromDateAndTime } from "../../lib/date.js";
import { absoluteMatchUrl, buildSofascoreDateUrl } from "./sofascore-helpers.js";
import type { RawSofascoreFixture } from "./sofascore-types.js";

export class SofascoreFixturesScraper {
  constructor(private readonly config: AppConfig) {}

  async scrapeFixtureDays(dates: string[]): Promise<ScrapedFixtureDay[]> {
    const browser = await chromium.launch({ headless: this.config.headless });
    const context = await browser.newContext({
      timezoneId: this.config.browserTimezone,
      locale: this.config.browserLocale,
    });

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeoutMs);

      const days: ScrapedFixtureDay[] = [];

      for (const date of dates) {
        days.push(await this.scrapeFixtureDay(page, date));
      }

      if (days.length > 0 && days.every((day) => day.fixtures.length === 0)) {
        throw new Error(
          `No fixtures extracted from Sofascore for any of the ${dates.length} requested dates.`,
        );
      }

      return days;
    } finally {
      await context.close();
      await browser.close();
    }
  }

  private async scrapeFixtureDay(page: Page, date: string): Promise<ScrapedFixtureDay> {
    const scrapedAtUtc = new Date().toISOString();

    await page.goto(buildSofascoreDateUrl(this.config.baseUrl, date), {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: this.config.timeoutMs }).catch(() => {
      // Sofascore can keep background activity alive; DOM content is enough for this phase.
    });

    await this.acceptConsentIfPresent(page);
    await page.waitForTimeout(800);

    const rawFixtures = await page.evaluate<RawSofascoreFixture[], { baseUrl: string; date: string }>(
      ({ baseUrl, date: matchDate }) => {
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

            const smallTexts = Array.from(
              child.querySelectorAll<HTMLElement>('bdi[class*="textStyle_body.small"]'),
            )
              .map((node) => node.textContent?.trim() ?? "")
              .filter(Boolean);

            const scoreTexts = Array.from(
              child.querySelectorAll<HTMLElement>("span.score"),
            )
              .map((node) => node.textContent?.trim() ?? "")
              .filter(Boolean);

            const teams = Array.from(
              child.querySelectorAll<HTMLElement>('bdi[class*="textStyle_body.medium"]'),
            )
              .map((node) => node.textContent?.trim() ?? "")
              .filter(Boolean);

            const teamImages = Array.from(
              child.querySelectorAll<HTMLImageElement>('img[src*="/api/v1/team/"]'),
            ).slice(0, 2);

            if (!eventId || teams.length < 2) {
              continue;
            }

            const marker = scoreTexts[0] ?? smallTexts.find((text) => text !== matchDate) ?? "";
            const kickoffTime = smallTexts.find((text) => /^\d{2}:\d{2}$/.test(text)) ?? null;
            const numericScores = scoreTexts
              .filter((text) => /^\d+$/.test(text))
              .map((text) => Number.parseInt(text, 10));
            const scorePair =
              numericScores.length >= 4
                ? [numericScores[0] ?? null, numericScores[2] ?? null]
                : numericScores.length >= 2
                  ? [numericScores[0] ?? null, numericScores[1] ?? null]
                  : null;
            const status =
              (marker === "-" && Boolean(kickoffTime)) || /^\d{2}:\d{2}$/.test(marker)
                ? "upcoming"
                : /^(FT|AET|PEN|AWD|WO|AP|Ended)$/i.test(marker) ||
                    /^(Full Time|After Extra Time|Penalties)$/i.test(marker)
                  ? "finished"
                  : /^(Postponed|PPD)$/i.test(marker)
                    ? "postponed"
                    : /^(Cancelled|Canceled|CANC|Abandoned|ABD)$/i.test(marker)
                      ? "cancelled"
                      : marker.includes("'") || /^(HT|1ST|2ND|ET|BT)$/i.test(marker)
                        ? "live"
                        : "unknown";

            fixtures.push({
              eventId,
              matchDate,
              kickoffTime,
              competitionName: currentCompetition,
              countryName: currentCountry,
              homeTeamId:
                teamImages[0]?.src.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
                null,
              homeTeamName: teams[0] ?? null,
              homeTeamLogoUrl: teamImages[0]?.src ?? null,
              awayTeamId:
                teamImages[1]?.src.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
                null,
              awayTeamName: teams[1] ?? null,
              awayTeamLogoUrl: teamImages[1]?.src ?? null,
              status,
              resultLabel:
                marker === "-" || /^\d{2}:\d{2}$/.test(marker) ? null : marker || null,
              homeScore: scorePair?.[0] ?? null,
              awayScore: scorePair?.[1] ?? null,
              href: new URL(href, baseUrl).toString(),
            });
          }
        }

        return fixtures;
      },
      { baseUrl: this.config.baseUrl, date },
    );

    if (rawFixtures.length === 0) {
      const diagnostic = await readEmptyPageDiagnostic(page);

      console.warn(
        `[sofascore][${date}] no fixtures extracted; title="${diagnostic.title}" body="${diagnostic.bodyPreview}"`,
      );
    }

    const fixtures: ScrapedFixture[] = rawFixtures
      .map((fixture) => ({
        source: "sofascore" as const,
        sourceEventId: fixture.eventId,
        matchDate: fixture.matchDate,
        kickoffAtUtc:
          fixture.kickoffTime ? kickoffUtcFromDateAndTime(fixture.matchDate, fixture.kickoffTime) : null,
        competitionName: fixture.competitionName,
        countryName: fixture.countryName,
        homeTeamId: fixture.homeTeamId,
        homeTeamName: fixture.homeTeamName,
        homeTeamLogoUrl: fixture.homeTeamLogoUrl,
        awayTeamId: fixture.awayTeamId,
        awayTeamName: fixture.awayTeamName,
        awayTeamLogoUrl: fixture.awayTeamLogoUrl,
        status: fixture.status,
        resultLabel: fixture.resultLabel,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        matchUrl: absoluteMatchUrl(this.config.baseUrl, fixture.href),
        scrapedAtUtc,
      }))
      .sort(compareFixtures);

    return {
      source: "sofascore",
      date,
      scrapedAtUtc,
      fixtures,
    };
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
}

async function readEmptyPageDiagnostic(
  page: Page,
): Promise<{ title: string; bodyPreview: string }> {
  const title = await page.title().catch(() => "");
  const bodyPreview = await page
    .evaluate(() =>
      document.body.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(" | "),
    )
    .catch(() => "");

  return {
    title,
    bodyPreview: bodyPreview.slice(0, 400),
  };
}

function compareFixtures(left: ScrapedFixture, right: ScrapedFixture): number {
  return (
    compareKickoff(left.kickoffAtUtc, right.kickoffAtUtc) ||
    compareNullable(left.countryName, right.countryName) ||
    compareNullable(left.competitionName, right.competitionName) ||
    left.homeTeamName.localeCompare(right.homeTeamName) ||
    left.awayTeamName.localeCompare(right.awayTeamName)
  );
}

function compareKickoff(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function compareNullable(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}
