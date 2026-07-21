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
    7,
    "pastDays",
  );

  const futureDays = readInteger(
    cli.futureDays,
    process.env.FUTESTAT_FUTURE_DAYS ?? process.env.FUTESTAT_DAYS_AHEAD,
    7,
    "futureDays",
  );

  const timeoutMs = readInteger(
    cli.timeoutMs,
    process.env.FUTESTAT_TIMEOUT_MS,
    60_000,
    "timeoutMs",
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
