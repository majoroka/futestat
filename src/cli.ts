import { loadAppConfig } from "./config/app-config.js";
import { runFixturesScrape } from "./application/run-fixtures-scrape.js";

async function main(): Promise<void> {
  const config = loadAppConfig();
  const result = await runFixturesScrape(config);

  console.log(
    JSON.stringify(
      {
        source: result.snapshot.source,
        status: result.snapshot.status,
        referenceDate: result.snapshot.referenceDate,
        datesIncluded: result.snapshot.datesIncluded,
        fixtureCount: result.snapshot.fixtureCount,
        visibleFixtureCount: result.snapshot.visibleFixtureCount,
        successfulDates: result.metrics.successfulDates,
        emptyDates: result.metrics.emptyDates,
        failedDates: result.metrics.failedDates,
        totalRunDurationMs: result.metrics.durationMs,
        latestPath: result.latestPath,
        runPath: result.runPath,
        dayPaths: result.dayPaths,
        metricsPath: result.metricsPath,
        matchDetails: result.matchDetails,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
