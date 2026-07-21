import type { AppConfig } from "../config/app-config.js";
import type { FixtureSnapshot } from "../domain/fixture.js";
import { buildDateRange } from "../lib/date.js";
import { SofascoreFixturesScraper } from "../infrastructure/sofascore/sofascore-fixtures-scraper.js";
import { JsonFixtureStore } from "../infrastructure/storage/json-fixture-store.js";

export interface RunFixturesScrapeResult {
  snapshot: FixtureSnapshot;
  latestPath: string;
  runPath: string;
}

export async function runFixturesScrape(config: AppConfig): Promise<RunFixturesScrapeResult> {
  const dates = buildDateRange(config.fromDate, config.daysAhead, config.includeToday);
  const scraper = new SofascoreFixturesScraper(config);
  const store = new JsonFixtureStore(config.outputDir);

  const snapshot = await scraper.scrapeUpcomingFixtures(dates);
  const { latestPath, runPath } = await store.write(snapshot);

  return { snapshot, latestPath, runPath };
}
