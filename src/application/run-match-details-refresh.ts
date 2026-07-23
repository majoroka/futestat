import type { AppConfig } from "../config/app-config.js";
import type { MatchFixture, PublicFixtureSnapshot } from "../domain/fixture.js";
import type { MatchDetailRefreshResult } from "../domain/match-detail.js";
import { SofascoreMatchDetailsScraper } from "../infrastructure/sofascore/sofascore-match-details-scraper.js";
import { JsonMatchDetailStore } from "../infrastructure/storage/json-match-detail-store.js";
import { logStructuredEvent } from "../lib/structured-logger.js";

export async function runMatchDetailsRefresh(
  config: AppConfig,
  snapshot: PublicFixtureSnapshot,
): Promise<MatchDetailRefreshResult> {
  const store = new JsonMatchDetailStore(config.matchDetailsOutputDir);
  const allUpcoming = snapshot.fixtures
    .filter((fixture) => fixture.status === "upcoming")
    .sort(compareUpcomingFixtures);
  const candidates: MatchFixture[] = [];

  for (const fixture of allUpcoming) {
    if (candidates.length >= config.matchDetailsMaxFixtures) {
      break;
    }

    const existing = await store.read(fixture.sourceEventId);
    if (
      existing &&
      store.isFresh({
        detail: existing,
        fixture,
        maxAgeHours: config.matchDetailsMaxAgeHours,
      })
    ) {
      continue;
    }

    candidates.push(fixture);
  }

  logStructuredEvent(config.structuredLogs, "info", "match_details_refresh_started", {
    upcomingCount: allUpcoming.length,
    candidateCount: candidates.length,
    maxFixturesPerRun: config.matchDetailsMaxFixtures,
    maxAgeHours: config.matchDetailsMaxAgeHours,
  });

  const scraper = new SofascoreMatchDetailsScraper(config);
  const result = await scraper.refreshUpcomingMatchDetails(
    allUpcoming,
    candidates.map((fixture) => ({ fixture })),
    async (detail) => {
      await store.write(detail);
    },
  );

  logStructuredEvent(config.structuredLogs, "info", "match_details_refresh_completed", {
    attempted: result.attempted,
    refreshed: result.refreshed,
    skipped: result.skipped,
    failed: result.failed,
    refreshedEventIds: result.refreshedEventIds,
    outputDir: result.outputDir,
  });
  return result;
}

function compareUpcomingFixtures(left: MatchFixture, right: MatchFixture): number {
  return (
    compareKickoff(left.kickoffAtUtc, right.kickoffAtUtc) ||
    left.matchDate.localeCompare(right.matchDate) ||
    String(left.competitionName ?? "").localeCompare(String(right.competitionName ?? "")) ||
    left.homeTeamName.localeCompare(right.homeTeamName)
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
