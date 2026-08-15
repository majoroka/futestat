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
  const eligibleFixtures = snapshot.fixtures
    .filter((fixture) => isEligibleForMatchDetails(snapshot.referenceDate, fixture))
    .sort((left, right) => compareUpcomingFixtures(left, right, snapshot.referenceDate));
  const candidates: MatchFixture[] = [];

  for (const fixture of eligibleFixtures) {
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
    eligibleCount: eligibleFixtures.length,
    candidateCount: candidates.length,
    maxFixturesPerRun: config.matchDetailsMaxFixtures,
    maxAgeHours: config.matchDetailsMaxAgeHours,
  });

  const scraper = new SofascoreMatchDetailsScraper(config);
  const result = await scraper.refreshMatchDetails(
    eligibleFixtures,
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

function compareUpcomingFixtures(
  left: MatchFixture,
  right: MatchFixture,
  referenceDate: string,
): number {
  return (
    compareReferenceDatePriority(left.matchDate, right.matchDate, referenceDate) ||
    compareKickoff(left.kickoffAtUtc, right.kickoffAtUtc) ||
    left.matchDate.localeCompare(right.matchDate) ||
    String(left.competitionName ?? "").localeCompare(String(right.competitionName ?? "")) ||
    left.homeTeamName.localeCompare(right.homeTeamName)
  );
}

function compareReferenceDatePriority(
  leftDate: string,
  rightDate: string,
  referenceDate: string,
): number {
  const leftPriority = leftDate === referenceDate ? 0 : 1;
  const rightPriority = rightDate === referenceDate ? 0 : 1;
  return leftPriority - rightPriority;
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

function isEligibleForMatchDetails(referenceDate: string, fixture: MatchFixture): boolean {
  if (fixture.status === "upcoming") {
    return true;
  }

  return fixture.status === "finished" && fixture.matchDate === referenceDate;
}

export const __testables = {
  isEligibleForMatchDetails,
};
