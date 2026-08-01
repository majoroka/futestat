import { parseAllCapturedTeamPages } from "../infrastructure/manual/team-pages-batch-parser.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const summary = await parseAllCapturedTeamPages(process.cwd(), options);

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function parseCliOptions(argv: string[]): {
  source?: "all" | "fotmob" | "soccer-rating";
  season?: string;
  force: boolean;
} {
  const options: {
    source?: "all" | "fotmob" | "soccer-rating";
    season?: string;
    force: boolean;
  } = {
    source: "all",
    force: true,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--source":
        if (rawValue !== "all" && rawValue !== "fotmob" && rawValue !== "soccer-rating") {
          throw new Error(`Invalid source "${rawValue ?? ""}". Expected all, fotmob or soccer-rating.`);
        }
        options.source = rawValue;
        break;
      case "--season":
        if (!rawValue) {
          throw new Error("Missing value for --season.");
        }
        options.season = rawValue;
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
  npm run parse:all-team-pages

Options:
  --source=all|fotmob|soccer-rating
  --season=YYYY-YYYY
  --force=true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
