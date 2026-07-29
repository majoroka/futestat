import type { AppConfig } from "../config/app-config.js";
import { buildCompetitionStandingsSourceMap } from "../config/competition-standings-sources.js";
import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import type { CompetitionStandingsRefreshResult } from "../domain/competition-standings.js";
import { ZerozeroStandingsScraper } from "../infrastructure/zerozero/zerozero-standings-scraper.js";
import { JsonCompetitionStandingsStore } from "../infrastructure/storage/json-competition-standings-store.js";
import { logStructuredEvent } from "../lib/structured-logger.js";

export async function runCompetitionStandingsRefresh(
  config: AppConfig,
  snapshot: PublicFixtureSnapshot,
): Promise<CompetitionStandingsRefreshResult> {
  const sourceMap = buildCompetitionStandingsSourceMap();
  const store = new JsonCompetitionStandingsStore(config.competitionStandingsOutputDir);
  const sources = [];

  for (const competitionId of uniqueCompetitionIds(snapshot)) {
    const source = sourceMap.get(competitionId);
    if (!source) {
      continue;
    }

    const existing = await store.read(competitionId);
    if (
      existing &&
      store.isFresh({
        snapshot: existing,
        maxAgeHours: config.competitionStandingsMaxAgeHours,
      })
    ) {
      continue;
    }

    sources.push(source);
  }

  logStructuredEvent(config.structuredLogs, "info", "competition_standings_refresh_started", {
    candidateCount: sources.length,
    maxAgeHours: config.competitionStandingsMaxAgeHours,
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

function uniqueCompetitionIds(snapshot: PublicFixtureSnapshot): string[] {
  const ids = new Set<string>();

  for (const fixture of snapshot.fixtures) {
    if (fixture.competitionId) {
      ids.add(fixture.competitionId);
    }
  }

  return Array.from(ids).sort();
}
