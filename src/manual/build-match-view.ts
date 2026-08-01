import path from "node:path";

import { buildMatchView } from "../infrastructure/manual/match-view-builder.js";

interface CliOptions {
  fixtureId: string;
  matchDate: string;
  output?: string;
  force: boolean;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await buildMatchView(process.cwd(), {
    ...options,
    output: options.output ? path.resolve(process.cwd(), options.output) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    force: false,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--fixture-id":
        options.fixtureId = requireValue(rawValue, flag);
        break;
      case "--match-date":
        options.matchDate = requireValue(rawValue, flag);
        break;
      case "--output":
        options.output = requireValue(rawValue, flag);
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

  if (!options.fixtureId || !options.matchDate) {
    throw new Error("Missing required arguments: --fixture-id and --match-date.");
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
  npm run build:match-view -- --fixture-id=16350227 --match-date=2026-08-15

Options:
  --fixture-id=<sourceEventId>
  --match-date=YYYY-MM-DD
  --output=<path-json>
  --force=true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
