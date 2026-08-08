import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parseFotmobTeamStatsHtml } from "../infrastructure/fotmob/fotmob-team-stats-parser.js";
import { JsonTeamStatsStore } from "../infrastructure/storage/json-team-stats-store.js";

interface CliOptions {
  input: string;
  output?: string;
  season?: string;
  competitionId?: string;
  competitionSlug?: string;
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

  const parserResult = parseFotmobTeamStatsHtml({
    html,
    inputPath,
    collectedAtUtc: inputStats.mtime.toISOString(),
    season: options.season,
    competitionId: options.competitionId,
    competitionSlug: options.competitionSlug,
    teamId: options.teamId,
    teamSlug: options.teamSlug,
  });

  const store = new JsonTeamStatsStore(repoRoot);
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
    competitionId: parserResult.competitionId,
    competitionSlug: parserResult.competitionSlug,
    sofascoreTeamId: options.sofascoreTeamId ?? null,
    teamId: parserResult.teamId,
    teamSlug: parserResult.teamSlug,
    parsedAtUtc,
    force: options.force,
  });

  console.log(
    JSON.stringify(
      {
        source: "fotmob",
        inputPath,
        outputPath: writeResult.outputPath,
        indexPath: writeResult.indexPath,
        season: parserResult.seasonFs,
        competitionId: parserResult.competitionId,
        competitionSlug: parserResult.competitionSlug,
        sofascoreTeamId: options.sofascoreTeamId ?? null,
        teamId: parserResult.teamId,
        teamSlug: parserResult.teamSlug,
        availabilityStatus: parserResult.snapshot.availability.status,
        metricsExtractedCount: parserResult.metricsExtractedCount,
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
      case "--competition-id":
        options.competitionId = requireValue(rawValue, flag);
        break;
      case "--competition-slug":
        options.competitionSlug = requireValue(rawValue, flag);
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
  npm run parse:fotmob-team-stats -- --input=raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html

Options:
  --input=<path-html>
  --output=<path-json>
  --season=YYYY-YYYY
  --competition-id=<id>
  --competition-slug=<slug>
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
