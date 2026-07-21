export interface UpcomingFixture {
  source: "sofascore";
  sourceEventId: string;
  scrapeDate: string;
  kickoffAtUtc: string;
  competitionName: string | null;
  countryName: string | null;
  homeTeamName: string;
  awayTeamName: string;
  matchUrl: string;
  scrapedAtUtc: string;
}

export interface FixtureSnapshot {
  source: "sofascore";
  status: "upcoming";
  scrapedAtUtc: string;
  datesScraped: string[];
  fixtureCount: number;
  fixtures: UpcomingFixture[];
  metadata: {
    browserTimezone: "UTC";
    scraperVersion: 1;
  };
}
