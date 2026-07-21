import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DayCollectionState,
  FixtureDay,
  MatchFixture,
  PublicFixtureSnapshot,
  ScrapedFixture,
  ScrapedFixtureDay,
} from "../../domain/fixture.js";
import { shiftIsoDate } from "../../lib/date.js";

export class JsonFixtureStore {
  constructor(private readonly outputDir: string) {}

  async reconcile(params: {
    scrapedDays: ScrapedFixtureDay[];
    referenceDate: string;
    pastDays: number;
    futureDays: number;
  }): Promise<{
    snapshot: PublicFixtureSnapshot;
    latestPath: string;
    runPath: string;
    dayPaths: string[];
  }> {
    const { scrapedDays, referenceDate, pastDays, futureDays } = params;
    const mergedDays: FixtureDay[] = [];
    const dayPaths: string[] = [];

    for (const scrapedDay of scrapedDays) {
      const existing = await this.readDay(scrapedDay.date);
      const collectionState = resolveCollectionState(scrapedDay.date, referenceDate);
      const mergedDay = mergeFixtureDay(existing, scrapedDay, collectionState);
      const dayPath = this.dayPath(scrapedDay.date);

      await mkdir(path.dirname(dayPath), { recursive: true });
      await writeFile(dayPath, JSON.stringify(mergedDay, null, 2), "utf8");

      mergedDays.push(mergedDay);
      dayPaths.push(dayPath);
    }

    const snapshot = buildPublicSnapshot({
      days: mergedDays,
      scrapedAtUtc: mergedDays
        .map((day) => day.lastScrapedAtUtc)
        .sort()
        .at(-1) ?? new Date().toISOString(),
      referenceDate,
      pastDays,
      futureDays,
    });

    const latestPath = path.join(this.outputDir, "latest.json");
    const runPath = path.join(
      this.outputDir,
      "runs",
      `fixtures-window-${snapshot.scrapedAtUtc.replaceAll(":", "").replaceAll(".", "")}.json`,
    );

    await mkdir(path.dirname(latestPath), { recursive: true });
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(latestPath, JSON.stringify(snapshot, null, 2), "utf8");
    await writeFile(runPath, JSON.stringify(snapshot, null, 2), "utf8");

    return { snapshot, latestPath, runPath, dayPaths };
  }

  private async readDay(date: string): Promise<FixtureDay | null> {
    try {
      const raw = await readFile(this.dayPath(date), "utf8");
      return JSON.parse(raw) as FixtureDay;
    } catch {
      return null;
    }
  }

  private dayPath(date: string): string {
    return path.join(this.outputDir, "days", `${date}.json`);
  }
}

function resolveCollectionState(date: string, referenceDate: string): DayCollectionState {
  const yesterday = shiftIsoDate(referenceDate, -1);

  if (date < yesterday) {
    return "frozen";
  }

  if (date === yesterday) {
    return "settling";
  }

  return "open";
}

function mergeFixtureDay(
  existing: FixtureDay | null,
  scrapedDay: ScrapedFixtureDay,
  collectionState: DayCollectionState,
): FixtureDay {
  const existingFixtures = new Map(
    (existing?.fixtures ?? []).map((fixture) => [fixture.sourceEventId, fixture]),
  );

  const mergedFixtures = scrapedDay.fixtures.map((fixture) => {
    const current = existingFixtures.get(fixture.sourceEventId) ?? null;

    if (current) {
      existingFixtures.delete(fixture.sourceEventId);
    }

    return mergeFixture(current, fixture);
  });

  for (const fixture of existingFixtures.values()) {
    mergedFixtures.push(fixture);
  }

  mergedFixtures.sort(compareFixtures);

  const frozenAtUtc =
    collectionState === "frozen"
      ? existing?.frozenAtUtc ?? scrapedDay.scrapedAtUtc
      : null;

  return {
    source: "sofascore",
    date: scrapedDay.date,
    collectionState,
    firstScrapedAtUtc: existing?.firstScrapedAtUtc ?? scrapedDay.scrapedAtUtc,
    lastScrapedAtUtc: scrapedDay.scrapedAtUtc,
    frozenAtUtc,
    fixtureCount: mergedFixtures.length,
    fixtures: mergedFixtures,
    metadata: {
      browserTimezone: "UTC",
      scraperVersion: 2,
    },
  };
}

function mergeFixture(
  existing: MatchFixture | null,
  incoming: ScrapedFixture,
): MatchFixture {
  if (!existing) {
    return {
      source: "sofascore",
      sourceEventId: incoming.sourceEventId,
      matchDate: incoming.matchDate,
      kickoffAtUtc: incoming.kickoffAtUtc,
      competitionName: incoming.competitionName,
      countryName: incoming.countryName,
      homeTeamId: incoming.homeTeamId,
      homeTeamName: incoming.homeTeamName,
      homeTeamLogoUrl: incoming.homeTeamLogoUrl,
      awayTeamId: incoming.awayTeamId,
      awayTeamName: incoming.awayTeamName,
      awayTeamLogoUrl: incoming.awayTeamLogoUrl,
      status: incoming.status,
      resultLabel: incoming.resultLabel,
      homeScore: incoming.homeScore,
      awayScore: incoming.awayScore,
      matchUrl: incoming.matchUrl,
      firstSeenAtUtc: incoming.scrapedAtUtc,
      lastSeenAtUtc: incoming.scrapedAtUtc,
      lastChangedAtUtc: incoming.scrapedAtUtc,
    };
  }

  const status = resolveMergedStatus(existing.status, incoming.status);
  const candidate: MatchFixture = {
    source: "sofascore",
    sourceEventId: existing.sourceEventId,
    matchDate: existing.matchDate,
    kickoffAtUtc: incoming.kickoffAtUtc ?? existing.kickoffAtUtc,
    competitionName: incoming.competitionName ?? existing.competitionName,
    countryName: incoming.countryName ?? existing.countryName,
    homeTeamId: incoming.homeTeamId ?? existing.homeTeamId,
    homeTeamName: incoming.homeTeamName || existing.homeTeamName,
    homeTeamLogoUrl: incoming.homeTeamLogoUrl ?? existing.homeTeamLogoUrl,
    awayTeamId: incoming.awayTeamId ?? existing.awayTeamId,
    awayTeamName: incoming.awayTeamName || existing.awayTeamName,
    awayTeamLogoUrl: incoming.awayTeamLogoUrl ?? existing.awayTeamLogoUrl,
    status,
    resultLabel: selectResultLabel(existing, incoming, status),
    homeScore: selectScore(existing.homeScore, incoming.homeScore, status),
    awayScore: selectScore(existing.awayScore, incoming.awayScore, status),
    matchUrl: incoming.matchUrl || existing.matchUrl,
    firstSeenAtUtc: existing.firstSeenAtUtc,
    lastSeenAtUtc: incoming.scrapedAtUtc,
    lastChangedAtUtc: existing.lastChangedAtUtc,
  };

  return hasFixtureChanged(existing, candidate)
    ? { ...candidate, lastChangedAtUtc: incoming.scrapedAtUtc }
    : candidate;
}

function resolveMergedStatus(
  existing: MatchFixture["status"],
  incoming: ScrapedFixture["status"],
): MatchFixture["status"] {
  if (incoming === "unknown") {
    return existing;
  }

  if (isTerminalStatus(existing) && !isTerminalStatus(incoming)) {
    return existing;
  }

  return incoming;
}

function selectResultLabel(
  existing: MatchFixture,
  incoming: ScrapedFixture,
  status: MatchFixture["status"],
): string | null {
  if (incoming.resultLabel) {
    return incoming.resultLabel;
  }

  if (status === existing.status) {
    return existing.resultLabel;
  }

  return existing.resultLabel;
}

function selectScore(
  existing: number | null,
  incoming: number | null,
  status: MatchFixture["status"],
): number | null {
  if (incoming !== null) {
    return incoming;
  }

  if (status === "finished" || status === "live") {
    return existing;
  }

  return existing;
}

function isTerminalStatus(status: MatchFixture["status"]): boolean {
  return status === "finished" || status === "postponed" || status === "cancelled";
}

function hasFixtureChanged(left: MatchFixture, right: MatchFixture): boolean {
  return (
    left.kickoffAtUtc !== right.kickoffAtUtc ||
    left.competitionName !== right.competitionName ||
    left.countryName !== right.countryName ||
    left.homeTeamId !== right.homeTeamId ||
    left.homeTeamName !== right.homeTeamName ||
    left.homeTeamLogoUrl !== right.homeTeamLogoUrl ||
    left.awayTeamId !== right.awayTeamId ||
    left.awayTeamName !== right.awayTeamName ||
    left.awayTeamLogoUrl !== right.awayTeamLogoUrl ||
    left.status !== right.status ||
    left.resultLabel !== right.resultLabel ||
    left.homeScore !== right.homeScore ||
    left.awayScore !== right.awayScore ||
    left.matchUrl !== right.matchUrl
  );
}

function buildPublicSnapshot(params: {
  days: FixtureDay[];
  scrapedAtUtc: string;
  referenceDate: string;
  pastDays: number;
  futureDays: number;
}): PublicFixtureSnapshot {
  const fixtures = params.days
    .flatMap((day) => day.fixtures)
    .filter((fixture) => fixture.status !== "live")
    .sort(compareFixtures);

  return {
    source: "sofascore",
    status: "window",
    scrapedAtUtc: params.scrapedAtUtc,
    referenceDate: params.referenceDate,
    datesIncluded: params.days.map((day) => day.date).sort(),
    fixtureCount: params.days.reduce((total, day) => total + day.fixtureCount, 0),
    visibleFixtureCount: fixtures.length,
    fixtures,
    metadata: {
      browserTimezone: "UTC",
      scraperVersion: 2,
      pastDays: params.pastDays,
      futureDays: params.futureDays,
      excludedStatuses: ["live"],
    },
  };
}

function compareFixtures(left: MatchFixture, right: MatchFixture): number {
  return (
    left.matchDate.localeCompare(right.matchDate) ||
    compareKickoff(left.kickoffAtUtc, right.kickoffAtUtc) ||
    compareNullable(left.countryName, right.countryName) ||
    compareNullable(left.competitionName, right.competitionName) ||
    left.homeTeamName.localeCompare(right.homeTeamName) ||
    left.awayTeamName.localeCompare(right.awayTeamName)
  );
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

function compareNullable(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}
