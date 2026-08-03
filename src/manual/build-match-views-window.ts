import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PublicFixtureSnapshot } from "../domain/fixture.js";
import { buildMatchView } from "../infrastructure/manual/match-view-builder.js";

interface CliOptions {
  force: boolean;
  limit: number | null;
}

interface BuildWindowResult {
  referenceDate: string | null;
  totalFixtures: number;
  built: number;
  failed: number;
  outputs: string[];
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const repoRoot = process.cwd();
  const snapshot = await loadSnapshot(repoRoot);
  const fixtures = Array.isArray(snapshot.fixtures) ? snapshot.fixtures : [];
  const selectedFixtures = options.limit === null ? fixtures : fixtures.slice(0, options.limit);

  const outputs: string[] = [];
  let failed = 0;

  for (const fixture of selectedFixtures) {
    try {
      const result = await buildMatchView(repoRoot, {
        fixtureId: fixture.sourceEventId,
        matchDate: fixture.matchDate,
        force: options.force,
      });

      outputs.push(result.outputPath);
    } catch (error) {
      failed += 1;
      console.warn(
        `[match-view][${fixture.matchDate}][${fixture.sourceEventId}] ${formatError(error)}`,
      );
    }
  }

  const result: BuildWindowResult = {
    referenceDate: snapshot.referenceDate ?? null,
    totalFixtures: selectedFixtures.length,
    built: outputs.length,
    failed,
    outputs,
  };

  console.log(JSON.stringify(result, null, 2));

  if (failed > 0 && outputs.length === 0) {
    process.exitCode = 1;
  }
}

async function loadSnapshot(repoRoot: string): Promise<PublicFixtureSnapshot> {
  const snapshotPath = path.join(repoRoot, "data", "fixtures", "latest.json");
  const raw = await readFile(snapshotPath, "utf8");
  return JSON.parse(raw) as PublicFixtureSnapshot;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    force: true,
    limit: null,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--force":
        options.force = parseBoolean(rawValue, flag);
        break;
      case "--limit":
        options.limit = parseInteger(rawValue, flag);
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

function parseInteger(value: string | undefined, flag: string): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}. Expected an integer.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer for ${flag}: "${value}".`);
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
Usage:
  npm run build:match-views-window

Options:
  --force=true|false
  --limit=<n>
`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
