import { chromium, type Page, type Response } from "playwright";

import type { AppConfig } from "../../config/app-config.js";
import type { MatchFixture } from "../../domain/fixture.js";
import type { MatchDetailRefreshResult, MatchDetailSnapshot } from "../../domain/match-detail.js";
import { logStructuredEvent } from "../../lib/structured-logger.js";
import { buildMatchDetailSnapshot, type CollectedMatchDetailPayloads } from "./sofascore-match-details-transformer.js";

interface MatchDetailCandidate {
  fixture: MatchFixture;
}

export class SofascoreMatchDetailsScraper {
  constructor(private readonly config: AppConfig) {}

  async refreshUpcomingMatchDetails(
    fixtures: MatchFixture[],
    candidates: MatchDetailCandidate[],
    onDetail: (detail: MatchDetailSnapshot) => Promise<void>,
  ): Promise<MatchDetailRefreshResult> {
    if (candidates.length === 0) {
      return {
        attempted: 0,
        refreshed: 0,
        skipped: fixtures.filter((fixture) => fixture.status === "upcoming").length,
        failed: 0,
        refreshedEventIds: [],
        outputDir: this.config.matchDetailsOutputDir,
      };
    }

    const browser = await chromium.launch({ headless: this.config.headless });
    const context = await browser.newContext({
      timezoneId: this.config.browserTimezone,
      locale: this.config.browserLocale,
    });

    let refreshed = 0;
    let failed = 0;
    const refreshedEventIds: string[] = [];

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeoutMs);

      for (const candidate of candidates) {
        try {
          const detail = await this.scrapeFixtureDetail(page, candidate.fixture);
          await onDetail(detail);
          refreshed += 1;
          refreshedEventIds.push(candidate.fixture.sourceEventId);

          logStructuredEvent(this.config.structuredLogs, "info", "match_detail_refreshed", {
            sourceEventId: candidate.fixture.sourceEventId,
            matchUrl: candidate.fixture.matchUrl,
          });
        } catch (error: unknown) {
          failed += 1;
          logStructuredEvent(this.config.structuredLogs, "warn", "match_detail_refresh_failed", {
            sourceEventId: candidate.fixture.sourceEventId,
            matchUrl: candidate.fixture.matchUrl,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }

        await page.waitForTimeout(this.config.matchDetailsDelayMs);
      }

      return {
        attempted: candidates.length,
        refreshed,
        skipped:
          fixtures.filter((fixture) => fixture.status === "upcoming").length - candidates.length,
        failed,
        refreshedEventIds,
        outputDir: this.config.matchDetailsOutputDir,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  private async scrapeFixtureDetail(page: Page, fixture: MatchFixture): Promise<MatchDetailSnapshot> {
    const payloads = new ResponseCollector(fixture.sourceEventId, fixture.homeTeamId, fixture.awayTeamId);
    const listener = (response: Response) => {
      payloads.capture(response).catch(() => undefined);
    };

    page.on("response", listener);

    try {
      await page.goto(buildMatchesTabUrl(fixture), {
        waitUntil: "domcontentloaded",
        timeout: this.config.timeoutMs,
      });

      await page.waitForLoadState("networkidle", { timeout: this.config.timeoutMs }).catch(() => {
        // Background fetches can stay alive; the important payloads usually arrive before this.
      });

      await this.acceptConsentIfPresent(page);
      await page.waitForTimeout(600);

      const requiredPayload = await payloads.waitForEventPayload(page);
      if (!requiredPayload) {
        throw new Error(`Missing event payload for match detail ${fixture.sourceEventId}.`);
      }

      return buildMatchDetailSnapshot({
        baseUrl: this.config.baseUrl,
        fixture,
        scrapedAtUtc: new Date().toISOString(),
        payloads: payloads.snapshot(),
      });
    } finally {
      page.off("response", listener);
    }
  }

  private async acceptConsentIfPresent(page: Page): Promise<void> {
    const labels = ["Accept", "Accept all", "Consent", "Consentir"];

    for (const label of labels) {
      const button = page.getByRole("button", { name: label });

      if ((await button.count()) === 0) {
        continue;
      }

      await button.first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      return;
    }
  }
}

class ResponseCollector {
  private payloads: CollectedMatchDetailPayloads = {
    event: null,
    tv: null,
    odds: null,
    h2hEvents: null,
    homeLast: null,
    awayLast: null,
    homeNext: null,
    awayNext: null,
  };

  constructor(
    private readonly sourceEventId: string,
    private readonly homeTeamId: string | null,
    private readonly awayTeamId: string | null,
  ) {}

  async capture(response: Response): Promise<void> {
    const url = response.url();
    const contentType = response.headers()["content-type"] ?? "";

    if (!contentType.includes("application/json")) {
      return;
    }

    if (!url.startsWith("https://www.sofascore.com/api/v1/")) {
      return;
    }

    const json = await response.json().catch(() => null);
    if (json === null) {
      return;
    }

    if (url.endsWith(`/event/${this.sourceEventId}`)) {
      this.payloads.event = json;
      return;
    }

    if (url.endsWith(`/tv/event/${this.sourceEventId}/country-channels`)) {
      this.payloads.tv = json;
      return;
    }

    if (url.includes(`/event/${this.sourceEventId}/odds/`) && url.endsWith("/featured")) {
      const providerId = parseProviderId(url);
      this.payloads.odds = { providerId, payload: json };
      return;
    }

    if (url.endsWith(`/event/${this.sourceEventId}/h2h`) || url.includes(`/event/`) && url.endsWith("/h2h/events")) {
      if (url.endsWith("/h2h/events")) {
        this.payloads.h2hEvents = json;
      }
      return;
    }

    if (this.homeTeamId && url.endsWith(`/team/${this.homeTeamId}/events/last/0`)) {
      this.payloads.homeLast = json;
      return;
    }

    if (this.awayTeamId && url.endsWith(`/team/${this.awayTeamId}/events/last/0`)) {
      this.payloads.awayLast = json;
      return;
    }

    if (this.homeTeamId && url.endsWith(`/team/${this.homeTeamId}/events/next/0`)) {
      this.payloads.homeNext = json;
      return;
    }

    if (this.awayTeamId && url.endsWith(`/team/${this.awayTeamId}/events/next/0`)) {
      this.payloads.awayNext = json;
    }
  }

  async waitForEventPayload(page: Page): Promise<unknown | null> {
    if (this.payloads.event) {
      return this.payloads.event;
    }

    await page
      .waitForResponse(
        (response) => response.url().endsWith(`/event/${this.sourceEventId}`) && response.ok(),
        { timeout: 8_000 },
      )
      .catch(() => undefined);

    return this.payloads.event ?? null;
  }

  snapshot(): CollectedMatchDetailPayloads {
    return this.payloads;
  }
}

function buildMatchesTabUrl(fixture: MatchFixture): string {
  const baseUrl = fixture.matchUrl.split("#")[0] ?? fixture.matchUrl;
  return `${baseUrl}#id:${fixture.sourceEventId},tab:matches`;
}

function parseProviderId(url: string): number | null {
  const match = url.match(/\/odds\/(\d+)\/featured$/);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(value) ? value : null;
}
