import {
  buildTeamPageManifestEntry,
  deriveTeamPageHtmlPath,
  type TeamPageCaptureOptions,
  validateTeamPageCaptureOptions,
} from "../infrastructure/manual/team-page-capture.js";
import { JsonTeamPageCaptureStore } from "../infrastructure/storage/json-team-page-capture-store.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  validateTeamPageCaptureOptions(options);

  const repoRoot = process.cwd();
  const store = new JsonTeamPageCaptureStore(repoRoot);
  const htmlPath = deriveTeamPageHtmlPath(repoRoot, options);
  await store.ensureWritableOutput(htmlPath, options.force);

  const response = await fetch(options.url, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Capture failed for ${options.url}. HTTP ${response.status} ${response.statusText}.`,
    );
  }

  const html = await response.text();
  const capturedAtUtc = new Date().toISOString();
  await store.writeHtml(htmlPath, html);
  const manifestPath = await store.updateManifest(
    buildTeamPageManifestEntry({
      repoRoot,
      options,
      htmlPath,
      finalUrl: response.url,
      capturedAtUtc,
    }),
  );

  console.log(
    JSON.stringify(
      {
        source: options.source,
        season: options.season,
        sofascoreTeamId: options.sofascoreTeamId ?? null,
        teamId: options.teamId,
        teamSlug: options.teamSlug,
        htmlPath,
        manifestPath,
        url: response.url,
        bytes: Buffer.byteLength(html, "utf8"),
        note: options.note ?? null,
      },
      null,
      2,
    ),
  );
}

function parseCliOptions(argv: string[]): TeamPageCaptureOptions {
  const options: Partial<TeamPageCaptureOptions> = {
    force: false,
  };

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);

    switch (flag) {
      case "--source":
        if (rawValue !== "fotmob" && rawValue !== "soccer-rating") {
          throw new Error(`Invalid source "${rawValue ?? ""}". Expected fotmob or soccer-rating.`);
        }
        options.source = rawValue;
        break;
      case "--season":
        options.season = requireValue(rawValue, flag);
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
      case "--url":
        options.url = requireValue(rawValue, flag);
        break;
      case "--competition-id":
        options.competitionId = requireValue(rawValue, flag);
        break;
      case "--competition-slug":
        options.competitionSlug = requireValue(rawValue, flag);
        break;
      case "--country-slug":
        options.countrySlug = requireValue(rawValue, flag);
        break;
      case "--force":
        options.force = parseBoolean(rawValue, flag);
        break;
      case "--note":
        options.note = requireValue(rawValue, flag);
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.source || !options.season || !options.teamId || !options.teamSlug || !options.url) {
    throw new Error(
      "Missing required arguments. Required: --source, --season, --team-id, --team-slug, --url.",
    );
  }

  return options as TeamPageCaptureOptions;
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
  npm run capture:team-page -- --source=fotmob --season=2025-2026 --sofascore-team-id=3006 --competition-id=238 --competition-slug=liga-portugal --team-id=9768 --team-slug=sporting-cp --url=https://www.fotmob.com/teams/9768/stats/sporting-cp/teams

Options:
  --source=fotmob|soccer-rating
  --season=YYYY-YYYY
  --sofascore-team-id=<id>       Optional but recommended for exact team linking
  --team-id=<id>
  --team-slug=<slug>
  --url=<url>
  --competition-id=<id>          Required for fotmob
  --competition-slug=<slug>      Required for fotmob
  --country-slug=<slug>          Required for soccer-rating
  --force=true|false
  --note=<text>
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
