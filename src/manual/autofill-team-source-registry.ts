import {
  autofillTeamSourceRegistry,
  type AutofillTeamSourceRegistryOptions,
} from "../infrastructure/manual/team-source-registry-autofill.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await autofillTeamSourceRegistry(process.cwd(), options);

  console.log(
    JSON.stringify(
      {
        registryPath: result.registryPath,
        totalEntries: result.totalEntries,
        processedEntries: result.processedEntries,
        sourceSummaries: result.sourceSummaries,
        dryRun: options.dryRun ?? false,
      },
      null,
      2,
    ),
  );
}

function parseCliOptions(argv: string[]): AutofillTeamSourceRegistryOptions {
  const options: AutofillTeamSourceRegistryOptions = {
    source: "all",
    dryRun: false,
    onlyPending: true,
    delayMs: 600,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--registry":
        options.registryPath = requireValue(rawValue, flag);
        break;
      case "--source":
        if (rawValue !== "all" && rawValue !== "fotmob" && rawValue !== "soccer-rating") {
          throw new Error(
            `Invalid source "${rawValue ?? ""}". Expected all, fotmob or soccer-rating.`,
          );
        }
        options.source = rawValue;
        break;
      case "--dry-run":
        options.dryRun = parseBoolean(rawValue, flag);
        break;
      case "--only-pending":
        options.onlyPending = parseBoolean(rawValue, flag);
        break;
      case "--competition-ids":
        options.competitionIds = parseCompetitionIds(rawValue, flag);
        break;
      case "--team-id":
        options.teamId = requireValue(rawValue, flag);
        break;
      case "--limit":
        options.limit = parseInteger(rawValue, flag);
        break;
      case "--delay-ms":
        options.delayMs = parseInteger(rawValue, flag);
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

function parseInteger(value: string | undefined, flag: string): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}. Expected integer.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${flag}: "${value}".`);
  }

  return parsed;
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

function printHelp(): void {
  console.log(`
Usage:
  npm run autofill:team-source-registry

Options:
  --registry=<path-json>
  --source=all|fotmob|soccer-rating
  --dry-run=true|false
  --only-pending=true|false
  --competition-ids=17,18
  --team-id=<sofascore-team-id>
  --limit=<n>
  --delay-ms=<ms>

Examples:
  npm run autofill:team-source-registry
  npm run autofill:team-source-registry -- --competition-ids=17,18
  npm run autofill:team-source-registry -- --source=fotmob --limit=25
  npm run autofill:team-source-registry -- --team-id=3006 --dry-run=true
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
