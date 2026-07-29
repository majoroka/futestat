import type { AppConfig } from "../../config/app-config.js";
import type { CompetitionStandingsSource } from "../../config/competition-standings-sources.js";
import type {
  CompetitionStandingsRefreshResult,
  CompetitionStandingsSnapshot,
} from "../../domain/competition-standings.js";
import { logStructuredEvent } from "../../lib/structured-logger.js";
import { extractCompetitionStandingsFromHtml } from "./zerozero-standings-parser.js";

export class ZerozeroStandingsScraper {
  constructor(private readonly config: AppConfig) {}

  async refreshCompetitionStandings(
    sources: CompetitionStandingsSource[],
    onSnapshot: (snapshot: CompetitionStandingsSnapshot) => Promise<void>,
  ): Promise<CompetitionStandingsRefreshResult> {
    let refreshed = 0;
    let failed = 0;
    const refreshedCompetitionIds: string[] = [];

    for (const source of sources) {
      try {
        const snapshot = await this.scrapeCompetition(source);
        await onSnapshot(snapshot);
        refreshed += 1;
        refreshedCompetitionIds.push(source.competitionId);
      } catch (error: unknown) {
        failed += 1;
        logStructuredEvent(this.config.structuredLogs, "warn", "competition_standings_refresh_failed", {
          competitionId: source.competitionId,
          zerozeroUrl: source.zerozeroUrl,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      attempted: sources.length,
      refreshed,
      skipped: 0,
      failed,
      refreshedCompetitionIds,
      outputDir: this.config.competitionStandingsOutputDir,
    };
  }

  private async scrapeCompetition(source: CompetitionStandingsSource): Promise<CompetitionStandingsSnapshot> {
    const response = await fetch(source.zerozeroUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`Zerozero standings page unavailable (${response.status})`);
    }

    const html = await response.text();
    return extractCompetitionStandingsFromHtml({
      html,
      competitionId: source.competitionId,
      competitionName: source.competitionName,
      countryName: source.countryName,
      zerozeroUrl: source.zerozeroUrl,
      mode: source.mode,
      status: source.status,
      scrapedAtUtc: new Date().toISOString(),
    });
  }
}
