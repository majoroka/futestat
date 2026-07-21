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
        datesScraped: result.snapshot.datesScraped,
        fixtureCount: result.snapshot.fixtureCount,
        latestPath: result.latestPath,
        runPath: result.runPath,
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
