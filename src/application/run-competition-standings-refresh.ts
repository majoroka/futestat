import type { AppConfig } from "../config/app-config.js";
import type { CompetitionStandingsSource } from "../config/competition-standings-sources.js";
import { resolveCompetitionStandingsSourceForFixture } from "./competition-standings-source-resolver.js";
import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import type { CompetitionStandingsRefreshResult } from "../domain/competition-standings.js";
import { ZerozeroStandingsScraper } from "../infrastructure/zerozero/zerozero-standings-scraper.js";
import { JsonCompetitionStandingsStore } from "../infrastructure/storage/json-competition-standings-store.js";
import { logStructuredEvent } from "../lib/structured-logger.js";

export async function runCompetitionStandingsRefresh(
  config: AppConfig,
  snapshot: PublicFixtureSnapshot,
  options?: {
    force?: boolean;
  },
): Promise<CompetitionStandingsRefreshResult> {
  const store = new JsonCompetitionStandingsStore(config.competitionStandingsOutputDir);
  const sources = [];
  const force = options?.force ?? false;

  for (const source of uniqueCompetitionSources(snapshot)) {
    if (!force) {
      const existing = await store.read(source.competitionId);
      if (
        existing &&
        store.isFresh({
          snapshot: existing,
          maxAgeHours: config.competitionStandingsMaxAgeHours,
        })
      ) {
        continue;
      }
    }

    sources.push(source);
  }

  logStructuredEvent(config.structuredLogs, "info", "competition_standings_refresh_started", {
    candidateCount: sources.length,
    maxAgeHours: config.competitionStandingsMaxAgeHours,
    force,
  });

  const scraper = new ZerozeroStandingsScraper(config);
  const result = await scraper.refreshCompetitionStandings(sources, async (snapshotItem) => {
    await store.write(snapshotItem);
  });

  logStructuredEvent(config.structuredLogs, "info", "competition_standings_refresh_completed", {
    attempted: result.attempted,
    refreshed: result.refreshed,
    failed: result.failed,
    refreshedCompetitionIds: result.refreshedCompetitionIds,
    outputDir: result.outputDir,
  });

  return result;
}

function uniqueCompetitionSources(snapshot: PublicFixtureSnapshot) {
  const byCompetitionId = new Map<string, CompetitionStandingsSource>();

  for (const fixture of snapshot.fixtures) {
    if (!fixture.competitionId) {
      continue;
    }

    const source = resolveCompetitionStandingsSourceForFixture({
      competitionId: fixture.competitionId,
      competitionName: fixture.competitionName,
      countryName: fixture.countryName,
    });

    if (!source) {
      continue;
    }

    byCompetitionId.set(source.competitionId, source);
  }

  return Array.from(byCompetitionId.values()).sort((left, right) =>
    left.competitionId.localeCompare(right.competitionId),
  );
}
