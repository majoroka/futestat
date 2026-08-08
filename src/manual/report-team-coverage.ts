import { generateTeamCoverageReport } from "../infrastructure/manual/team-coverage-report.js";

interface CliOptions {
  snapshotPath?: string;
  outputPath?: string;
  write: boolean;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await generateTeamCoverageReport(process.cwd(), options);

  console.log(
    JSON.stringify(
      {
        ...result.report,
        outputPath: result.outputPath,
      },
      null,
      2,
    ),
  );
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    write: true,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--snapshot":
        options.snapshotPath = requireValue(rawValue, flag);
        break;
      case "--output":
        options.outputPath = requireValue(rawValue, flag);
        break;
      case "--write":
        options.write = parseBoolean(rawValue, flag);
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

function printHelp(): void {
  console.log(`
Usage:
  npm run report:team-coverage

Options:
  --snapshot=<path-json>
  --output=<path-json>
  --write=true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
