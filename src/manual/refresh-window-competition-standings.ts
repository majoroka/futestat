import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadAppConfig } from "../config/app-config.js";
import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import { runCompetitionStandingsRefresh } from "../application/run-competition-standings-refresh.js";
import { JsonCompetitionStandingsStore } from "../infrastructure/storage/json-competition-standings-store.js";

interface CliOptions {
  force: boolean;
  snapshotPath: string | null;
  maxCompetitions: number | null;
  delayMs: number;
  stopAfterBlocked: number | null;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const config = loadAppConfig([]);
  const store = new JsonCompetitionStandingsStore(config.competitionStandingsOutputDir);
  const snapshotPath = path.resolve(options.snapshotPath ?? path.join(config.outputDir, "latest.json"));
  const snapshot = await readSnapshot(snapshotPath);
  const allCompetitionIds = Array.from(
    new Set(snapshot.fixtures.map((fixture) => fixture.competitionId).filter(isNonEmptyString)),
  ).sort((left, right) => left.localeCompare(right));
  const prioritizedCompetitionIds = await prioritizeCompetitionIds(
    allCompetitionIds,
    store,
    config.competitionStandingsMaxAgeHours,
  );
  const competitionIds =
    options.maxCompetitions !== null
      ? prioritizedCompetitionIds.slice(0, options.maxCompetitions)
      : prioritizedCompetitionIds;
  const limitedSnapshot = {
    ...snapshot,
    fixtures: snapshot.fixtures.filter((fixture) =>
      fixture.competitionId ? competitionIds.includes(fixture.competitionId) : false,
    ),
  };
  const result = await runCompetitionStandingsRefresh(config, limitedSnapshot, {
    force: options.force,
    delayMs: options.delayMs,
    maxConsecutiveBlockedFailures: options.stopAfterBlocked,
  });

  console.log(
    JSON.stringify(
      {
        snapshotPath,
        referenceDate: snapshot.referenceDate,
        datesIncluded: snapshot.datesIncluded,
        discoveredCompetitionIds: allCompetitionIds,
        discoveredCompetitions: allCompetitionIds.length,
        prioritizedCompetitionIds,
        selectedCompetitionIds: competitionIds,
        selectedCompetitions: competitionIds.length,
        force: options.force,
        delayMs: options.delayMs,
        stopAfterBlocked: options.stopAfterBlocked,
        ...result,
      },
      null,
      2,
    ),
  );
}

async function readSnapshot(snapshotPath: string): Promise<PublicFixtureSnapshot> {
  const raw = await readFile(snapshotPath, "utf8");
  return JSON.parse(raw) as PublicFixtureSnapshot;
}

async function prioritizeCompetitionIds(
  competitionIds: string[],
  store: JsonCompetitionStandingsStore,
  maxAgeHours: number,
): Promise<string[]> {
  const missingOrStale: string[] = [];
  const fresh: string[] = [];

  for (const competitionId of competitionIds) {
    const existing = await store.read(competitionId);
    if (
      existing &&
      store.isFresh({
        snapshot: existing,
        maxAgeHours,
      })
    ) {
      fresh.push(competitionId);
      continue;
    }

    missingOrStale.push(competitionId);
  }

  return [...missingOrStale, ...fresh];
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    force: false,
    snapshotPath: null,
    maxCompetitions: 6,
    delayMs: 2500,
    stopAfterBlocked: 2,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--force":
        options.force = parseBoolean(rawValue, flag);
        break;
      case "--snapshot-path":
        options.snapshotPath = requireValue(rawValue, flag);
        break;
      case "--max-competitions":
        options.maxCompetitions = parseOptionalInteger(rawValue, flag);
        break;
      case "--delay-ms":
        options.delayMs = parseOptionalInteger(rawValue, flag);
        break;
      case "--stop-after-blocked":
        options.stopAfterBlocked = parseOptionalInteger(rawValue, flag);
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return options;
}

function parseOptionalInteger(value: string | undefined, flag: string): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer for ${flag}: "${value}".`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined, flag: string): boolean {
  if (!value) {
    throw new Error(`Missing value for ${flag}. Expected true or false.`);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid boolean for ${flag}: "${value}". Expected true or false.`);
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function printHelp(): void {
  console.log(`
Usage:
  npm run refresh:competition-standings-window -- [options]

Options:
  --force=true|false
  --snapshot-path=data/fixtures/latest.json
  --max-competitions=6
  --delay-ms=2500
  --stop-after-blocked=2
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
