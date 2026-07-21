import path from "node:path";

import { parseCliOptions } from "../lib/cli.js";
import { assertIsoDate, todayUtcIsoDate } from "../lib/date.js";

export interface AppConfig {
  baseUrl: string;
  fromDate: string;
  daysAhead: number;
  includeToday: boolean;
  outputDir: string;
  headless: boolean;
  timeoutMs: number;
  browserTimezone: "UTC";
  browserLocale: "en-US";
}

export function loadAppConfig(argv = process.argv.slice(2)): AppConfig {
  const cli = parseCliOptions(argv);

  const fromDate = assertIsoDate(
    cli.fromDate ?? process.env.FUTESTAT_FROM_DATE ?? todayUtcIsoDate(),
    "fromDate",
  );

  const daysAhead = readInteger(
    cli.daysAhead,
    process.env.FUTESTAT_DAYS_AHEAD,
    3,
    "daysAhead",
  );

  const includeToday = readBoolean(
    cli.includeToday,
    process.env.FUTESTAT_INCLUDE_TODAY,
    true,
  );

  const timeoutMs = readInteger(
    cli.timeoutMs,
    process.env.FUTESTAT_TIMEOUT_MS,
    60_000,
    "timeoutMs",
  );

  if (daysAhead < 0) {
    throw new Error(`daysAhead must be >= 0. Received ${daysAhead}.`);
  }

  if (timeoutMs < 1_000) {
    throw new Error(`timeoutMs must be >= 1000. Received ${timeoutMs}.`);
  }

  return {
    baseUrl: process.env.FUTESTAT_BASE_URL ?? "https://www.sofascore.com",
    fromDate,
    daysAhead,
    includeToday,
    outputDir: path.resolve(
      cli.outputDir ?? process.env.FUTESTAT_OUTPUT_DIR ?? "data/fixtures",
    ),
    headless: readBoolean(cli.headless, process.env.FUTESTAT_HEADLESS, true),
    timeoutMs,
    browserTimezone: "UTC",
    browserLocale: "en-US",
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
