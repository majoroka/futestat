export interface CliOptions {
  fromDate?: string;
  daysAhead?: number;
  includeToday?: boolean;
  outputDir?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--from":
        options.fromDate = rawValue;
        break;
      case "--days-ahead":
        options.daysAhead = parseOptionalInteger(rawValue, flag);
        break;
      case "--include-today":
        options.includeToday = parseBoolean(rawValue, flag);
        break;
      case "--output-dir":
        options.outputDir = rawValue;
        break;
      case "--headless":
        options.headless = parseBoolean(rawValue, flag);
        break;
      case "--timeout-ms":
        options.timeoutMs = parseOptionalInteger(rawValue, flag);
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

function parseOptionalInteger(value: string | undefined, flag: string): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer for ${flag}: "${value}".`);
  }

  return parsed;
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
  npm run scrape:fixtures -- [options]

Options:
  --from=YYYY-MM-DD
  --days-ahead=3
  --include-today=true
  --output-dir=data/fixtures
  --headless=true
  --timeout-ms=60000
`);
}
