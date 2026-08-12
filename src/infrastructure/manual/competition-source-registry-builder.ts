import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_COMPETITION_STANDINGS_SOURCES,
  type CompetitionStandingsSource,
} from "../../config/competition-standings-sources.js";
import {
  DEFAULT_ALLOWED_COMPETITIONS,
  type AllowedCompetition,
} from "../../config/competition-whitelist.js";
import type {
  CompetitionSourceRegistry,
  CompetitionSourceRegistryEntry,
} from "../../domain/competition-source-registry.js";

interface ParsedCompetitionSourceRow {
  countryName: string;
  competitionName: string;
  sofascoreCompetitionId: string;
  zerozeroCompetitionId: string;
  fotmobCompetitionId: string;
  soccerRatingCompetitionId: string;
}

export interface BuildCompetitionSourceRegistryOptions {
  inputPath?: string;
  outputPath?: string;
  write?: boolean;
}

export interface BuildCompetitionSourceRegistryResult {
  inputPath: string;
  outputPath: string;
  registry: CompetitionSourceRegistry;
  summary: {
    whitelistCount: number;
    sourceRowCount: number;
    entryCount: number;
    standingsBackedCount: number;
  };
}

export async function buildCompetitionSourceRegistry(
  cwd: string,
  options: BuildCompetitionSourceRegistryOptions = {},
): Promise<BuildCompetitionSourceRegistryResult> {
  const inputPath = options.inputPath ?? path.join(cwd, "data", "competition-source-registry.source.txt");
  const outputPath = options.outputPath ?? path.join(cwd, "data", "competition-source-registry.json");
  const write = options.write ?? true;

  const sourceRows = await loadCompetitionSourceRows(inputPath);
  const rowsByCompetitionId = new Map(
    sourceRows.map((row) => [row.sofascoreCompetitionId, row]),
  );

  ensureUniqueIds(sourceRows);

  const missingInSource = DEFAULT_ALLOWED_COMPETITIONS.filter(
    (competition) => !rowsByCompetitionId.has(competition.competitionId),
  );
  const unexpectedInSource = sourceRows.filter(
    (row) => !DEFAULT_ALLOWED_COMPETITIONS.some((competition) => competition.competitionId === row.sofascoreCompetitionId),
  );

  if (missingInSource.length > 0 || unexpectedInSource.length > 0) {
    throw new Error(
      [
        "Competition source file is inconsistent with the whitelist.",
        `Missing in source: ${missingInSource.map((item) => item.competitionId).join(", ") || "-"}`,
        `Unexpected in source: ${unexpectedInSource.map((item) => item.sofascoreCompetitionId).join(", ") || "-"}`,
      ].join(" "),
    );
  }

  const entries = DEFAULT_ALLOWED_COMPETITIONS.map((competition) =>
    buildRegistryEntry(competition, rowsByCompetitionId.get(competition.competitionId)!),
  );

  const registry: CompetitionSourceRegistry = {
    generatedAtUtc: new Date().toISOString(),
    sourcePath: inputPath,
    entryCount: entries.length,
    entries,
  };

  if (write) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(registry, null, 2), "utf8");
  }

  return {
    inputPath,
    outputPath,
    registry,
    summary: {
      whitelistCount: DEFAULT_ALLOWED_COMPETITIONS.length,
      sourceRowCount: sourceRows.length,
      entryCount: entries.length,
      standingsBackedCount: entries.filter((entry) => entry.standings.enabled).length,
    },
  };
}

async function loadCompetitionSourceRows(filePath: string): Promise<ParsedCompetitionSourceRow[]> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("País |"))
    .filter((line) => !/^[-]+$/.test(line));

  return lines.map(parseSourceRow);
}

function parseSourceRow(line: string): ParsedCompetitionSourceRow {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length !== 6) {
    throw new Error(`Invalid competition source row: "${line}"`);
  }

  const [
    countryName,
    competitionName,
    sofascoreCompetitionId,
    zerozeroCompetitionId,
    fotmobCompetitionId,
    soccerRatingCompetitionId,
  ] = parts;

  return {
    countryName,
    competitionName,
    sofascoreCompetitionId,
    zerozeroCompetitionId,
    fotmobCompetitionId,
    soccerRatingCompetitionId,
  };
}

function ensureUniqueIds(rows: ParsedCompetitionSourceRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.sofascoreCompetitionId)) {
      throw new Error(`Duplicate Sofascore competition id in source file: ${row.sofascoreCompetitionId}`);
    }
    seen.add(row.sofascoreCompetitionId);
  }
}

function buildRegistryEntry(
  competition: AllowedCompetition,
  sourceRow: ParsedCompetitionSourceRow,
): CompetitionSourceRegistryEntry {
  const standingsVariants = DEFAULT_COMPETITION_STANDINGS_SOURCES.filter(
    (entry) => entry.competitionId === competition.competitionId,
  );
  const primaryStandings = pickPrimaryStandingsEntry(competition, standingsVariants);

  const competitionAliases = dedupeStrings([
    ...(competition.competitionAliases ?? []),
    ...standingsVariants.flatMap((entry) => entry.competitionAliases ?? []),
    ...standingsVariants
      .map((entry) => entry.competitionName)
      .filter((name) => name !== competition.competitionName),
  ]);
  const countryAliases = dedupeStrings([
    ...(competition.countryAliases ?? []),
    ...standingsVariants.flatMap((entry) => entry.countryAliases ?? []),
  ]);
  const variantZerozeroUrls = dedupeStrings(
    standingsVariants
      .map((entry) => entry.zerozeroUrl)
      .filter((url) => url !== primaryStandings?.zerozeroUrl),
  );
  const variantCompetitionNames = dedupeStrings(
    standingsVariants
      .map((entry) => entry.competitionName)
      .filter((name) => name !== primaryStandings?.competitionName),
  );

  return {
    sofascoreCompetitionId: competition.competitionId,
    competitionName: competition.competitionName,
    countryName: competition.countryName,
    competitionAliases,
    countryAliases,
    standings: {
      enabled: primaryStandings?.enabled ?? false,
      mode: primaryStandings?.mode ?? null,
      status: primaryStandings?.status ?? null,
      primaryZerozeroUrl: primaryStandings?.zerozeroUrl ?? null,
      variantZerozeroUrls,
    },
    sources: {
      zerozero: {
        status: sourceRow.zerozeroCompetitionId ? "mapped" : "pending",
        sourceCompetitionId: sourceRow.zerozeroCompetitionId || null,
        competitionName: primaryStandings?.competitionName ?? sourceRow.competitionName,
        countryName: primaryStandings?.countryName ?? sourceRow.countryName,
        url: primaryStandings?.zerozeroUrl ?? null,
        notes: null,
        variantUrls: variantZerozeroUrls,
        variantCompetitionNames,
      },
      fotmob: {
        status: sourceRow.fotmobCompetitionId ? "mapped" : "pending",
        sourceCompetitionId: sourceRow.fotmobCompetitionId || null,
        competitionName: sourceRow.competitionName,
        countryName: sourceRow.countryName,
        url: null,
        notes: null,
      },
      soccerRating: {
        status: sourceRow.soccerRatingCompetitionId ? "mapped" : "pending",
        sourceCompetitionId: sourceRow.soccerRatingCompetitionId || null,
        competitionName: sourceRow.competitionName,
        countryName: sourceRow.countryName,
        url: null,
        notes: null,
      },
    },
  };
}

function pickPrimaryStandingsEntry(
  competition: AllowedCompetition,
  entries: CompetitionStandingsSource[],
): CompetitionStandingsSource | null {
  if (entries.length === 0) {
    return null;
  }

  return (
    entries.find(
      (entry) =>
        entry.competitionName === competition.competitionName &&
        entry.countryName === competition.countryName,
    ) ?? entries[0]
  );
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}
