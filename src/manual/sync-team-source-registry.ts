import { syncTeamSourceRegistry } from "../infrastructure/manual/team-source-registry-sync.js";

interface CliOptions {
  snapshotPath?: string;
  registryPath?: string;
  standingsDir?: string;
  seedFromStandings?: boolean;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await syncTeamSourceRegistry(process.cwd(), options);
  console.log(JSON.stringify(result, null, 2));
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--snapshot":
        options.snapshotPath = requireValue(rawValue, flag);
        break;
      case "--registry":
        options.registryPath = requireValue(rawValue, flag);
        break;
      case "--standings-dir":
        options.standingsDir = requireValue(rawValue, flag);
        break;
      case "--seed-standings":
        options.seedFromStandings = parseBoolean(rawValue, flag);
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

function printHelp(): void {
  console.log(`
Usage:
  npm run sync:team-source-registry

Options:
  --snapshot=<path-json>
  --registry=<path-json>
  --standings-dir=<path-dir>
  --seed-standings=true|false
`);
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
