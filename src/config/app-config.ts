import path from "node:path";

import { parseCliOptions } from "../lib/cli.js";
import { assertIsoDate, todayIsoDateInTimeZone } from "../lib/date.js";

export interface AppConfig {
  baseUrl: string;
  referenceDate: string;
  pastDays: number;
  futureDays: number;
  outputDir: string;
  headless: boolean;
  timeoutMs: number;
  browserTimezone: "UTC";
  browserLocale: "en-US";
  referenceTimeZone: "Europe/Lisbon";
  maxAttemptsPerDate: number;
  retryDelayMs: number;
  captureFailureArtifacts: boolean;
  structuredLogs: boolean;
  diagnosticsDir: string;
  matchDetailsEnabled: boolean;
  matchDetailsMaxFixtures: number;
  matchDetailsMaxAgeHours: number;
  matchDetailsDelayMs: number;
  matchDetailsOutputDir: string;
}

export function loadAppConfig(argv = process.argv.slice(2)): AppConfig {
  const cli = parseCliOptions(argv);

  const referenceDate = assertIsoDate(
    cli.referenceDate ??
      process.env.FUTESTAT_REFERENCE_DATE ??
      process.env.FUTESTAT_FROM_DATE ??
      todayIsoDateInTimeZone("Europe/Lisbon"),
    "referenceDate",
  );

  const pastDays = readInteger(
    cli.pastDays,
    process.env.FUTESTAT_PAST_DAYS,
    1,
    "pastDays",
  );

  const futureDays = readInteger(
    cli.futureDays,
    process.env.FUTESTAT_FUTURE_DAYS ?? process.env.FUTESTAT_DAYS_AHEAD,
    1,
    "futureDays",
  );

  const timeoutMs = readInteger(
    cli.timeoutMs,
    process.env.FUTESTAT_TIMEOUT_MS,
    60_000,
    "timeoutMs",
  );

  const maxAttemptsPerDate = readInteger(
    cli.maxAttemptsPerDate,
    process.env.FUTESTAT_MAX_ATTEMPTS_PER_DATE,
    3,
    "maxAttemptsPerDate",
  );

  const retryDelayMs = readInteger(
    cli.retryDelayMs,
    process.env.FUTESTAT_RETRY_DELAY_MS,
    1_500,
    "retryDelayMs",
  );

  if (pastDays < 0) {
    throw new Error(`pastDays must be >= 0. Received ${pastDays}.`);
  }

  if (futureDays < 0) {
    throw new Error(`futureDays must be >= 0. Received ${futureDays}.`);
  }

  if (timeoutMs < 1_000) {
    throw new Error(`timeoutMs must be >= 1000. Received ${timeoutMs}.`);
  }

  if (maxAttemptsPerDate < 1) {
    throw new Error(`maxAttemptsPerDate must be >= 1. Received ${maxAttemptsPerDate}.`);
  }

  if (retryDelayMs < 0) {
    throw new Error(`retryDelayMs must be >= 0. Received ${retryDelayMs}.`);
  }

  const matchDetailsMaxFixtures = readInteger(
    cli.matchDetailsMaxFixtures,
    process.env.FUTESTAT_MATCH_DETAILS_MAX_FIXTURES,
    64,
    "matchDetailsMaxFixtures",
  );

  const matchDetailsMaxAgeHours = readInteger(
    cli.matchDetailsMaxAgeHours,
    process.env.FUTESTAT_MATCH_DETAILS_MAX_AGE_HOURS,
    12,
    "matchDetailsMaxAgeHours",
  );

  const matchDetailsDelayMs = readInteger(
    cli.matchDetailsDelayMs,
    process.env.FUTESTAT_MATCH_DETAILS_DELAY_MS,
    1_200,
    "matchDetailsDelayMs",
  );

  if (matchDetailsMaxFixtures < 0) {
    throw new Error(
      `matchDetailsMaxFixtures must be >= 0. Received ${matchDetailsMaxFixtures}.`,
    );
  }

  if (matchDetailsMaxAgeHours < 1) {
    throw new Error(
      `matchDetailsMaxAgeHours must be >= 1. Received ${matchDetailsMaxAgeHours}.`,
    );
  }

  if (matchDetailsDelayMs < 0) {
    throw new Error(`matchDetailsDelayMs must be >= 0. Received ${matchDetailsDelayMs}.`);
  }

  return {
    baseUrl: process.env.FUTESTAT_BASE_URL ?? "https://www.sofascore.com",
    referenceDate,
    pastDays,
    futureDays,
    outputDir: path.resolve(
      cli.outputDir ?? process.env.FUTESTAT_OUTPUT_DIR ?? "data/fixtures",
    ),
    headless: readBoolean(cli.headless, process.env.FUTESTAT_HEADLESS, true),
    timeoutMs,
    browserTimezone: "UTC",
    browserLocale: "en-US",
    referenceTimeZone: "Europe/Lisbon",
    maxAttemptsPerDate,
    retryDelayMs,
    captureFailureArtifacts: readBoolean(
      cli.captureFailureArtifacts,
      process.env.FUTESTAT_CAPTURE_FAILURE_ARTIFACTS,
      true,
    ),
    structuredLogs: readBoolean(
      cli.structuredLogs,
      process.env.FUTESTAT_STRUCTURED_LOGS,
      true,
    ),
    diagnosticsDir: path.resolve(
      process.env.FUTESTAT_DIAGNOSTICS_DIR ??
        path.join(cli.outputDir ?? process.env.FUTESTAT_OUTPUT_DIR ?? "data/fixtures", "diagnostics"),
    ),
    matchDetailsEnabled: readBoolean(
      cli.matchDetailsEnabled,
      process.env.FUTESTAT_MATCH_DETAILS_ENABLED,
      true,
    ),
    matchDetailsMaxFixtures,
    matchDetailsMaxAgeHours,
    matchDetailsDelayMs,
    matchDetailsOutputDir: path.resolve(
      process.env.FUTESTAT_MATCH_DETAILS_OUTPUT_DIR ??
        path.join(cli.outputDir ?? process.env.FUTESTAT_OUTPUT_DIR ?? "data/fixtures", "details"),
    ),
  };
}

function readInteger(
  cliValue: number | undefined,
  envValue: string | undefined,
  fallback: number,
  label: string,
): number {
  if (cliValue !== undefined) {
    return cliValue;
  }

  if (envValue !== undefined) {
    const parsed = Number.parseInt(envValue, 10);

    if (!Number.isInteger(parsed)) {
      throw new Error(`Invalid ${label}: "${envValue}".`);
    }

    return parsed;
  }

  return fallback;
}

function readBoolean(
  cliValue: boolean | undefined,
  envValue: string | undefined,
  fallback: boolean,
): boolean {
  if (cliValue !== undefined) {
    return cliValue;
  }

  if (envValue === "true") {
    return true;
  }

  if (envValue === "false") {
    return false;
  }

  if (envValue !== undefined) {
    throw new Error(`Invalid boolean value: "${envValue}".`);
  }

  return fallback;
}
