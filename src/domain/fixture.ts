export type FixtureStatus =
  | "upcoming"
  | "finished"
  | "live"
  | "postponed"
  | "cancelled"
  | "unknown";

export type DayCollectionState = "open" | "settling" | "frozen";

export interface MatchFixture {
  source: "sofascore";
  sourceEventId: string;
  matchDate: string;
  kickoffAtUtc: string | null;
  competitionName: string | null;
  countryName: string | null;
  homeTeamId: string | null;
  homeTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamId: string | null;
  awayTeamName: string;
  awayTeamLogoUrl: string | null;
  status: FixtureStatus;
  resultLabel: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchUrl: string;
  firstSeenAtUtc: string;
  lastSeenAtUtc: string;
  lastChangedAtUtc: string;
}

export interface FixtureDay {
  source: "sofascore";
  date: string;
  collectionState: DayCollectionState;
  firstScrapedAtUtc: string;
  lastScrapedAtUtc: string;
  frozenAtUtc: string | null;
  fixtureCount: number;
  fixtures: MatchFixture[];
  metadata: {
    browserTimezone: "UTC";
    scraperVersion: 2;
  };
}

export interface PublicFixtureSnapshot {
  source: "sofascore";
  status: "window";
  scrapedAtUtc: string;
  referenceDate: string;
  datesIncluded: string[];
  fixtureCount: number;
  visibleFixtureCount: number;
  fixtures: MatchFixture[];
  metadata: {
    browserTimezone: "UTC";
    scraperVersion: 2;
    pastDays: number;
    futureDays: number;
    excludedStatuses: FixtureStatus[];
  };
}

export type FixtureScrapeAttemptOutcome = "success" | "empty" | "retryable_failure" | "failure";

export interface FixtureScrapeAttemptMetrics {
  attempt: number;
  startedAtUtc: string;
  completedAtUtc: string;
  durationMs: number;
  outcome: FixtureScrapeAttemptOutcome;
  fixtureCount: number;
  errorMessage: string | null;
  diagnosticTitle: string | null;
  diagnosticBodyPreview: string | null;
  artifacts: {
    screenshotPath: string | null;
    htmlPath: string | null;
  };
}

export interface FixtureScrapeDayMetrics {
  date: string;
  status: "succeeded" | "empty" | "failed";
  startedAtUtc: string;
  completedAtUtc: string;
  durationMs: number;
  fixtureCount: number;
  attemptCount: number;
  lastErrorMessage: string | null;
  attempts: FixtureScrapeAttemptMetrics[];
}

export interface FixtureScrapeRunMetrics {
  source: "sofascore";
  referenceDate: string;
  startedAtUtc: string;
  completedAtUtc: string;
  durationMs: number;
  totalDates: number;
  maxAttemptsPerDate: number;
  retryDelayMs: number;
  successfulDates: number;
  emptyDates: number;
  failedDates: number;
  totalFixtures: number;
  days: FixtureScrapeDayMetrics[];
}

export interface ScrapedFixture {
  source: "sofascore";
  sourceEventId: string;
  matchDate: string;
  kickoffAtUtc: string | null;
  competitionName: string | null;
  countryName: string | null;
  homeTeamId: string | null;
  homeTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamId: string | null;
  awayTeamName: string;
  awayTeamLogoUrl: string | null;
  status: FixtureStatus;
  resultLabel: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchUrl: string;
  scrapedAtUtc: string;
}

export interface ScrapedFixtureDay {
  source: "sofascore";
  date: string;
  scrapedAtUtc: string;
  fixtures: ScrapedFixture[];
}

export interface ScrapeFixtureDayResult {
  day: ScrapedFixtureDay;
  metrics: FixtureScrapeDayMetrics;
}

export interface ScrapeFixtureDaysResult {
  days: ScrapedFixtureDay[];
  metrics: FixtureScrapeRunMetrics;
}
