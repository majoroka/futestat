import {
  captureTeamPagesBatch,
  type BatchCaptureTeamPagesOptions,
} from "../infrastructure/manual/team-pages-batch-capture.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const summary = await captureTeamPagesBatch(process.cwd(), options);

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function parseCliOptions(argv: string[]): BatchCaptureTeamPagesOptions {
  const options: BatchCaptureTeamPagesOptions = {
    source: "all",
    onlyActive: false,
    onlyMapped: true,
    force: false,
    dryRun: false,
    delayMs: 1_200,
    season: "",
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--registry":
        options.registryPath = requireValue(rawValue, flag);
        break;
      case "--source":
        if (rawValue !== "all" && rawValue !== "fotmob" && rawValue !== "soccer-rating") {
          throw new Error(`Invalid source "${rawValue ?? ""}". Expected all, fotmob or soccer-rating.`);
        }
        options.source = rawValue;
        break;
      case "--season":
        options.season = requireValue(rawValue, flag);
        break;
      case "--only-active":
        options.onlyActive = parseBoolean(rawValue, flag);
        break;
      case "--only-mapped":
        options.onlyMapped = parseBoolean(rawValue, flag);
        break;
      case "--team-id":
        options.teamId = requireValue(rawValue, flag);
        break;
      case "--competition-id":
        options.competitionId = requireValue(rawValue, flag);
        break;
      case "--limit":
        options.limit = parseInteger(rawValue, flag);
        break;
      case "--delay-ms":
        options.delayMs = parseInteger(rawValue, flag);
        break;
      case "--force":
        options.force = parseBoolean(rawValue, flag);
        break;
      case "--dry-run":
        options.dryRun = parseBoolean(rawValue, flag);
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.season) {
    throw new Error("Missing required argument: --season.");
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

function printHelp(): void {
  console.log(`
Usage:
  npm run capture:team-pages-batch -- --season=2026-2027

Options:
  --registry=<path-json>
  --source=all|fotmob|soccer-rating
  --season=YYYY-YYYY
  --only-active=true|false
  --only-mapped=true|false
  --team-id=<sofascore-team-id>
  --competition-id=<competition-id>
  --limit=<n>
  --delay-ms=<ms>
  --force=true|false
  --dry-run=true|false

Examples:
  npm run capture:team-pages-batch -- --season=2026-2027 --source=fotmob --only-active=true
  npm run capture:team-pages-batch -- --season=2026-2027 --source=soccer-rating --limit=20 --dry-run=true
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
