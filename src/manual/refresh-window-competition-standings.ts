import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadAppConfig } from "../config/app-config.js";
import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import { runCompetitionStandingsRefresh } from "../application/run-competition-standings-refresh.js";

interface CliOptions {
  force: boolean;
  snapshotPath: string | null;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const config = loadAppConfig([]);
  const snapshotPath = path.resolve(options.snapshotPath ?? path.join(config.outputDir, "latest.json"));
  const snapshot = await readSnapshot(snapshotPath);
  const competitionIds = Array.from(
    new Set(snapshot.fixtures.map((fixture) => fixture.competitionId).filter(isNonEmptyString)),
  ).sort((left, right) => left.localeCompare(right));
  const result = await runCompetitionStandingsRefresh(config, snapshot, {
    force: options.force,
  });

  console.log(
    JSON.stringify(
      {
        snapshotPath,
        referenceDate: snapshot.referenceDate,
        datesIncluded: snapshot.datesIncluded,
        selectedCompetitionIds: competitionIds,
        selectedCompetitions: competitionIds.length,
        force: options.force,
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

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    force: false,
    snapshotPath: null,
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
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return options;
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
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
