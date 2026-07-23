import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppConfig } from "../config/app-config.js";
import type { FixtureScrapeRunMetrics, PublicFixtureSnapshot } from "../domain/fixture.js";
import type { MatchDetailRefreshResult } from "../domain/match-detail.js";
import { buildSlidingWindowDates } from "../lib/date.js";
import { logStructuredEvent } from "../lib/structured-logger.js";
import { SofascoreFixturesScraper } from "../infrastructure/sofascore/sofascore-fixtures-scraper.js";
import { JsonFixtureStore } from "../infrastructure/storage/json-fixture-store.js";
import { runMatchDetailsRefresh } from "./run-match-details-refresh.js";

export interface RunFixturesScrapeResult {
  snapshot: PublicFixtureSnapshot;
  metrics: FixtureScrapeRunMetrics;
  latestPath: string;
  runPath: string;
  dayPaths: string[];
  metricsPath: string;
  matchDetails: MatchDetailRefreshResult | null;
}

export async function runFixturesScrape(config: AppConfig): Promise<RunFixturesScrapeResult> {
  const runStartedAtUtc = new Date().toISOString();
  const dates = buildSlidingWindowDates(
    config.referenceDate,
    config.pastDays,
    config.futureDays,
  );
  logStructuredEvent(config.structuredLogs, "info", "fixtures_run_started", {
    referenceDate: config.referenceDate,
    dates,
    outputDir: config.outputDir,
    maxAttemptsPerDate: config.maxAttemptsPerDate,
    retryDelayMs: config.retryDelayMs,
  });
  const scraper = new SofascoreFixturesScraper(config);
  const store = new JsonFixtureStore(config.outputDir);

  const { days: scrapedDays, metrics } = await scraper.scrapeFixtureDays(dates);
  const { snapshot, latestPath, runPath, dayPaths } = await store.reconcile({
    scrapedDays,
    referenceDate: config.referenceDate,
    pastDays: config.pastDays,
    futureDays: config.futureDays,
  });

  const metricsPath = path.join(
    config.outputDir,
    "runs",
    `fixtures-metrics-${runStartedAtUtc.replaceAll(":", "").replaceAll(".", "")}.json`,
  );

  await mkdir(path.dirname(metricsPath), { recursive: true });
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2), "utf8");

  let matchDetails: MatchDetailRefreshResult | null = null;
  if (config.matchDetailsEnabled) {
    matchDetails = await runMatchDetailsRefresh(config, snapshot).catch((error: unknown) => {
      logStructuredEvent(config.structuredLogs, "warn", "match_details_refresh_aborted", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
  }

  logStructuredEvent(config.structuredLogs, "info", "fixtures_run_completed", {
    referenceDate: config.referenceDate,
    totalDates: metrics.totalDates,
    successfulDates: metrics.successfulDates,
    emptyDates: metrics.emptyDates,
    failedDates: metrics.failedDates,
    totalFixtures: metrics.totalFixtures,
    durationMs: metrics.durationMs,
    latestPath,
    metricsPath,
    matchDetailsRefreshed: matchDetails?.refreshed ?? 0,
    matchDetailsFailed: matchDetails?.failed ?? 0,
  });

  return { snapshot, metrics, latestPath, runPath, dayPaths, metricsPath, matchDetails };
}
