import { loadAppConfig } from "../config/app-config.js";
import type { CompetitionStandingsSource } from "../config/competition-standings-sources.js";
import { listPrimaryCompetitionStandingsSources } from "../application/competition-standings-source-resolver.js";
import { JsonCompetitionStandingsStore } from "../infrastructure/storage/json-competition-standings-store.js";
import { ZerozeroStandingsScraper } from "../infrastructure/zerozero/zerozero-standings-scraper.js";

interface CliOptions {
  competitionIds: Set<string> | null;
  force: boolean;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const config = loadAppConfig([]);
  const store = new JsonCompetitionStandingsStore(config.competitionStandingsOutputDir);
  const allSources = listPrimaryCompetitionStandingsSources({
    competitionIds: options.competitionIds,
  });

  const refreshCandidates: CompetitionStandingsSource[] = [];
  let skippedFresh = 0;

  for (const source of allSources) {
    if (options.force) {
      refreshCandidates.push(source);
      continue;
    }

    const existing = await store.read(source.competitionId);
    if (
      existing &&
      store.isFresh({
        snapshot: existing,
        maxAgeHours: config.competitionStandingsMaxAgeHours,
      })
    ) {
      skippedFresh += 1;
      continue;
    }

    refreshCandidates.push(source);
  }

  const scraper = new ZerozeroStandingsScraper(config);
  const result = await scraper.refreshCompetitionStandings(refreshCandidates, async (snapshot) => {
    await store.write(snapshot);
  });

  console.log(
    JSON.stringify(
      {
        requestedCompetitionIds: options.competitionIds ? [...options.competitionIds] : null,
        selectedSources: allSources.length,
        skippedFresh,
        force: options.force,
        ...result,
      },
      null,
      2,
    ),
  );
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    competitionIds: null,
    force: false,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--competition-ids":
        options.competitionIds = parseCompetitionIds(rawValue, flag);
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

  return options;
}

function parseCompetitionIds(value: string | undefined, flag: string): Set<string> {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return new Set(ids);
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
  npm run refresh:competition-standings -- [options]

Options:
  --competition-ids=18,54,53,44,182,131
  --force=true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
