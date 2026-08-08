import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parseSoccerRatingTeamContextHtml } from "../infrastructure/soccer-rating/soccer-rating-team-context-parser.js";
import { JsonTeamContextStore } from "../infrastructure/storage/json-team-context-store.js";

interface CliOptions {
  input: string;
  output?: string;
  season?: string;
  countrySlug?: string;
  sofascoreTeamId?: string;
  teamId?: string;
  teamSlug?: string;
  force: boolean;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const repoRoot = process.cwd();
  const inputPath = path.resolve(repoRoot, options.input);
  const [html, inputStats] = await Promise.all([readFile(inputPath, "utf8"), stat(inputPath)]);

  const parserResult = parseSoccerRatingTeamContextHtml({
    html,
    inputPath,
    collectedAtUtc: inputStats.mtime.toISOString(),
    season: options.season,
    countrySlug: options.countrySlug,
    teamId: options.teamId,
    teamSlug: options.teamSlug,
  });

  const store = new JsonTeamContextStore(repoRoot);
  const outputPath = path.resolve(
    repoRoot,
    options.output ?? store.deriveOutputPath(inputPath),
  );
  const parsedAtUtc = new Date().toISOString();
  const writeResult = await store.writeSnapshot({
    snapshot: parserResult.snapshot,
    outputPath,
    sourceHtmlPath: inputPath,
    seasonFs: parserResult.seasonFs,
    countrySlug: parserResult.countrySlug,
    sofascoreTeamId: options.sofascoreTeamId ?? null,
    teamId: parserResult.teamId,
    teamSlug: parserResult.teamSlug,
    parsedAtUtc,
    force: options.force,
  });

  console.log(
    JSON.stringify(
      {
        source: "soccer-rating",
        inputPath,
        outputPath: writeResult.outputPath,
        indexPath: writeResult.indexPath,
        season: parserResult.seasonFs,
        countrySlug: parserResult.countrySlug,
        sofascoreTeamId: options.sofascoreTeamId ?? null,
        teamId: parserResult.teamId,
        teamSlug: parserResult.teamSlug,
        availabilityStatus: parserResult.snapshot.availability.status,
        fieldCount: parserResult.fieldCount,
      },
      null,
      2,
    ),
  );
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    force: false,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--input":
        options.input = requireValue(rawValue, flag);
        break;
      case "--output":
        options.output = requireValue(rawValue, flag);
        break;
      case "--season":
        options.season = requireValue(rawValue, flag);
        break;
      case "--country-slug":
        options.countrySlug = requireValue(rawValue, flag);
        break;
      case "--sofascore-team-id":
        options.sofascoreTeamId = requireValue(rawValue, flag);
        break;
      case "--team-id":
        options.teamId = requireValue(rawValue, flag);
        break;
      case "--team-slug":
        options.teamSlug = requireValue(rawValue, flag);
        break;
      case "--force":
        options.force = parseBoolean(rawValue, flag);
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.input) {
    throw new Error("Missing required argument: --input.");
  }

  return options as CliOptions;
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
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

function printHelp(): void {
  console.log(`
Usage:
  npm run parse:soccer-rating-team-context -- --input=raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html

Options:
  --input=<path-html>
  --output=<path-json>
  --season=YYYY-YYYY
  --country-slug=<slug>
  --sofascore-team-id=<id>
  --team-id=<id>
  --team-slug=<slug>
  --force=true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
