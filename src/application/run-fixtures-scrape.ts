import type { AppConfig } from "../config/app-config.js";
import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import { buildSlidingWindowDates } from "../lib/date.js";
import { SofascoreFixturesScraper } from "../infrastructure/sofascore/sofascore-fixtures-scraper.js";
import { JsonFixtureStore } from "../infrastructure/storage/json-fixture-store.js";

export interface RunFixturesScrapeResult {
  snapshot: PublicFixtureSnapshot;
  latestPath: string;
  runPath: string;
  dayPaths: string[];
}

export async function runFixturesScrape(config: AppConfig): Promise<RunFixturesScrapeResult> {
  const dates = buildSlidingWindowDates(
    config.referenceDate,
    config.pastDays,
    config.futureDays,
  );
  const scraper = new SofascoreFixturesScraper(config);
  const store = new JsonFixtureStore(config.outputDir);

  const scrapedDays = await scraper.scrapeFixtureDays(dates);
  const { snapshot, latestPath, runPath, dayPaths } = await store.reconcile({
    scrapedDays,
    referenceDate: config.referenceDate,
    pastDays: config.pastDays,
    futureDays: config.futureDays,
  });

  return { snapshot, latestPath, runPath, dayPaths };
}
