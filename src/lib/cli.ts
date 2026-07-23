export interface CliOptions {
  referenceDate?: string;
  pastDays?: number;
  futureDays?: number;
  outputDir?: string;
  headless?: boolean;
  timeoutMs?: number;
  maxAttemptsPerDate?: number;
  retryDelayMs?: number;
  captureFailureArtifacts?: boolean;
  structuredLogs?: boolean;
  matchDetailsEnabled?: boolean;
  matchDetailsMaxFixtures?: number;
  matchDetailsMaxAgeHours?: number;
  matchDetailsDelayMs?: number;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--reference-date":
      case "--from":
        options.referenceDate = rawValue;
        break;
      case "--past-days":
        options.pastDays = parseOptionalInteger(rawValue, flag);
        break;
      case "--future-days":
      case "--days-ahead":
        options.futureDays = parseOptionalInteger(rawValue, flag);
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
      case "--max-attempts-per-date":
        options.maxAttemptsPerDate = parseOptionalInteger(rawValue, flag);
        break;
      case "--retry-delay-ms":
        options.retryDelayMs = parseOptionalInteger(rawValue, flag);
        break;
      case "--capture-failure-artifacts":
        options.captureFailureArtifacts = parseBoolean(rawValue, flag);
        break;
      case "--structured-logs":
        options.structuredLogs = parseBoolean(rawValue, flag);
        break;
      case "--match-details-enabled":
        options.matchDetailsEnabled = parseBoolean(rawValue, flag);
        break;
      case "--match-details-max-fixtures":
        options.matchDetailsMaxFixtures = parseOptionalInteger(rawValue, flag);
        break;
      case "--match-details-max-age-hours":
        options.matchDetailsMaxAgeHours = parseOptionalInteger(rawValue, flag);
        break;
      case "--match-details-delay-ms":
        options.matchDetailsDelayMs = parseOptionalInteger(rawValue, flag);
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
  --reference-date=YYYY-MM-DD
  --past-days=7
  --future-days=7
  --output-dir=data/fixtures
  --headless=true
  --timeout-ms=60000
  --max-attempts-per-date=3
  --retry-delay-ms=1500
  --capture-failure-artifacts=true
  --structured-logs=true
  --match-details-enabled=true
  --match-details-max-fixtures=64
  --match-details-max-age-hours=12
  --match-details-delay-ms=1200
`);
}
