import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCanonicalCompetitionNameById } from "../../config/competition-whitelist.js";
import type { CompetitionStandingsSnapshot } from "../../domain/competition-standings.js";
import type { MatchFixture, PublicFixtureSnapshot } from "../../domain/fixture.js";
import type {
  TeamSourceRegistry,
  TeamSourceRegistryEntry,
} from "../../domain/team-source-registry.js";
import { findBestTeamNameMatch } from "../../lib/team-name-matcher.js";

export interface SyncTeamSourceRegistryOptions {
  snapshotPath?: string;
  registryPath?: string;
  standingsDir?: string;
  seedFromStandings?: boolean;
}

export interface SyncTeamSourceRegistryResult {
  registryPath: string;
  totalEntries: number;
  activeEntries: number;
  addedEntries: number;
  retainedEntries: number;
  standingsSeededEntries: number;
  fixtureLinkedSeedEntries: number;
}

export async function syncTeamSourceRegistry(
  repoRoot: string,
  options: SyncTeamSourceRegistryOptions,
): Promise<SyncTeamSourceRegistryResult> {
  const snapshotPath = path.resolve(
    repoRoot,
    options.snapshotPath ?? path.join("data", "fixtures", "latest.json"),
  );
  const registryPath = path.resolve(
    repoRoot,
    options.registryPath ?? path.join("data", "team-source-registry.json"),
  );
  const standingsDir = path.resolve(
    repoRoot,
    options.standingsDir ?? path.join("data", "fixtures", "standings"),
  );

  const snapshot = await readJsonRequired<PublicFixtureSnapshot>(
    snapshotPath,
    `Public fixture snapshot not found at ${snapshotPath}.`,
  );
  const existing = await readJsonOptional<TeamSourceRegistry>(registryPath);
  const existingMap = new Map<string, TeamSourceRegistryEntry>();

  for (const entry of existing?.entries ?? []) {
    const key = buildTeamKey(entry.sofascoreTeamId, entry.teamName, entry.competitionId);
    existingMap.set(key, {
      ...entry,
      activeInCurrentWindow: false,
      fixtureAppearancesInCurrentWindow: 0,
    });
  }

  let addedEntries = 0;
  let standingsSeededEntries = 0;
  let fixtureLinkedSeedEntries = 0;

  if (options.seedFromStandings !== false) {
    const standingsSnapshots = await readStandingsSnapshots(standingsDir);
    for (const standings of standingsSnapshots.values()) {
      standingsSeededEntries += seedTeamsFromStandings(
        existingMap,
        snapshot.referenceDate,
        standings,
      );
    }
  }

  for (const fixture of snapshot.fixtures) {
    fixtureLinkedSeedEntries += Number(
      upsertFixtureTeam(existingMap, snapshot.referenceDate, fixture, "home"),
    );
    fixtureLinkedSeedEntries += Number(
      upsertFixtureTeam(existingMap, snapshot.referenceDate, fixture, "away"),
    );
  }

  for (const [key, entry] of existingMap) {
    if (entry.firstSeenReferenceDate) {
      continue;
    }

    const seeded = createRegistryEntry({
      referenceDate: snapshot.referenceDate,
      teamId: entry.sofascoreTeamId,
      teamName: entry.teamName,
      competitionId: entry.competitionId,
      competitionName: normalizeCompetitionName(entry.competitionId, entry.competitionName),
      countryName: entry.countryName,
      activeInCurrentWindow: entry.activeInCurrentWindow,
      fixtureAppearancesInCurrentWindow: entry.fixtureAppearancesInCurrentWindow,
    });
    existingMap.set(key, {
      ...seeded,
      sources: entry.sources,
    });
  }

  const entries = Array.from(existingMap.values()).sort(compareRegistryEntries);
  for (const entry of entries) {
    if (entry.firstSeenReferenceDate === snapshot.referenceDate) {
      addedEntries += 1;
    }
  }

  const registry: TeamSourceRegistry = {
    generatedAtUtc: new Date().toISOString(),
    referenceDate: snapshot.referenceDate,
    snapshotPath: toProjectRelativePath(repoRoot, snapshotPath),
    entries,
  };

  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");

  return {
    registryPath,
    totalEntries: entries.length,
    activeEntries: entries.filter((entry) => entry.activeInCurrentWindow).length,
    addedEntries,
    retainedEntries: entries.length - addedEntries,
    standingsSeededEntries,
    fixtureLinkedSeedEntries,
  };
}

function upsertFixtureTeam(
  entryMap: Map<string, TeamSourceRegistryEntry>,
  referenceDate: string,
  fixture: MatchFixture,
  side: "home" | "away",
): boolean {
  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const teamName = side === "home" ? fixture.homeTeamName : fixture.awayTeamName;
  const key = buildTeamKey(teamId, teamName, fixture.competitionId);
  const existingById = entryMap.get(key);

  if (existingById) {
    hydrateFixtureEntry(existingById, referenceDate, fixture, teamName);
    return false;
  }

  const seededByStandings = findSeededEntryWithoutTeamId(
    entryMap,
    fixture.competitionId,
    teamName,
  );

  if (seededByStandings) {
    entryMap.delete(seededByStandings.key);
    seededByStandings.entry.sofascoreTeamId = String(teamId ?? "");
    seededByStandings.entry.teamName = teamName;
    hydrateFixtureEntry(seededByStandings.entry, referenceDate, fixture, teamName);
    entryMap.set(
      buildTeamKey(seededByStandings.entry.sofascoreTeamId, teamName, fixture.competitionId),
      seededByStandings.entry,
    );
    return true;
  }

  const created = createRegistryEntry({
    referenceDate,
    teamId,
    teamName,
    competitionId: fixture.competitionId,
    competitionName: normalizeCompetitionName(fixture.competitionId, fixture.competitionName),
    countryName: fixture.countryName,
    activeInCurrentWindow: true,
    fixtureAppearancesInCurrentWindow: 1,
  });
  seedDefaultSourceHints(created, fixture);
  entryMap.set(key, created);
  return false;
}

function hydrateFixtureEntry(
  entry: TeamSourceRegistryEntry,
  referenceDate: string,
  fixture: MatchFixture,
  teamName: string,
): void {
  entry.activeInCurrentWindow = true;
  entry.fixtureAppearancesInCurrentWindow += 1;
  entry.lastSeenReferenceDate = referenceDate;
  entry.teamName = teamName;
  entry.countryName = fixture.countryName;
  entry.competitionId = fixture.competitionId;
  entry.competitionName = normalizeCompetitionName(fixture.competitionId, fixture.competitionName);
  seedDefaultSourceHints(entry, fixture);
}

function seedTeamsFromStandings(
  entryMap: Map<string, TeamSourceRegistryEntry>,
  referenceDate: string,
  standings: CompetitionStandingsSnapshot,
): number {
  let addedEntries = 0;

  for (const teamName of extractTeamNamesFromStandings(standings)) {
    const existing = findEntryByCompetitionAndName(
      entryMap,
      standings.competitionId,
      teamName,
    );
    if (existing) {
      existing.entry.countryName = standings.countryName;
      existing.entry.competitionId = standings.competitionId;
      existing.entry.competitionName = normalizeCompetitionName(
        standings.competitionId,
        standings.competitionName,
      );
      seedDefaultSourceHintsFromStandings(existing.entry, standings);
      continue;
    }

    const created = createRegistryEntry({
      referenceDate,
      teamId: null,
      teamName,
      competitionId: standings.competitionId,
      competitionName: normalizeCompetitionName(
        standings.competitionId,
        standings.competitionName,
      ),
      countryName: standings.countryName,
      activeInCurrentWindow: false,
      fixtureAppearancesInCurrentWindow: 0,
    });
    seedDefaultSourceHintsFromStandings(created, standings);
    entryMap.set(buildTeamKey(null, teamName, standings.competitionId), created);
    addedEntries += 1;
  }

  return addedEntries;
}

function createRegistryEntry(params: {
  referenceDate: string;
  teamId: string | null;
  teamName: string;
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  activeInCurrentWindow: boolean;
  fixtureAppearancesInCurrentWindow: number;
}): TeamSourceRegistryEntry {
  const teamSlug = slugify(params.teamName);
  const competitionSlug = slugify(params.competitionName);
  const countrySlug = slugify(params.countryName);

  return {
    sofascoreTeamId: String(params.teamId ?? ""),
    teamName: params.teamName,
    countryName: params.countryName,
    competitionId: params.competitionId,
    competitionName: params.competitionName,
    activeInCurrentWindow: params.activeInCurrentWindow,
    fixtureAppearancesInCurrentWindow: params.fixtureAppearancesInCurrentWindow,
    firstSeenReferenceDate: params.referenceDate,
    lastSeenReferenceDate: params.referenceDate,
    sources: {
      fotmob: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: teamSlug || null,
        competitionId: params.competitionId,
        competitionSlug: competitionSlug || null,
        url: null,
        notes: null,
      },
      soccerRating: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: teamSlug || null,
        countrySlug: countrySlug || null,
        url: null,
        notes: null,
      },
    },
  };
}

function normalizeCompetitionName(
  competitionId: string | null,
  competitionName: string | null,
): string | null {
  return getCanonicalCompetitionNameById(competitionId) ?? competitionName;
}

function seedDefaultSourceHints(entry: TeamSourceRegistryEntry, fixture: MatchFixture): void {
  if (!entry.sources.fotmob.teamSlug) {
    entry.sources.fotmob.teamSlug = slugify(entry.teamName) || null;
  }
  if (!entry.sources.fotmob.competitionId) {
    entry.sources.fotmob.competitionId = fixture.competitionId;
  }
  if (!entry.sources.fotmob.competitionSlug) {
    entry.sources.fotmob.competitionSlug = slugify(fixture.competitionName) || null;
  }
  if (!entry.sources.soccerRating.teamSlug) {
    entry.sources.soccerRating.teamSlug = slugify(entry.teamName) || null;
  }
  if (!entry.sources.soccerRating.countrySlug) {
    entry.sources.soccerRating.countrySlug = slugify(fixture.countryName) || null;
  }
}

function seedDefaultSourceHintsFromStandings(
  entry: TeamSourceRegistryEntry,
  standings: CompetitionStandingsSnapshot,
): void {
  if (!entry.sources.fotmob.teamSlug) {
    entry.sources.fotmob.teamSlug = slugify(entry.teamName) || null;
  }
  if (!entry.sources.fotmob.competitionId) {
    entry.sources.fotmob.competitionId = standings.competitionId;
  }
  if (!entry.sources.fotmob.competitionSlug) {
    entry.sources.fotmob.competitionSlug = slugify(standings.competitionName) || null;
  }
  if (!entry.sources.soccerRating.teamSlug) {
    entry.sources.soccerRating.teamSlug = slugify(entry.teamName) || null;
  }
  if (!entry.sources.soccerRating.countrySlug) {
    entry.sources.soccerRating.countrySlug = slugify(standings.countryName) || null;
  }
}

function buildTeamKey(
  teamId: string | null,
  teamName: string,
  competitionId: string | null,
): string {
  if (teamId) {
    return `id:${teamId}`;
  }

  return `name:${competitionId ?? ""}:${normalizeToken(teamName)}`;
}

function findSeededEntryWithoutTeamId(
  entryMap: Map<string, TeamSourceRegistryEntry>,
  competitionId: string | null,
  teamName: string,
): { key: string; entry: TeamSourceRegistryEntry } | null {
  const candidates = Array.from(entryMap.entries())
    .filter(([, entry]) => !entry.sofascoreTeamId && entry.competitionId === competitionId)
    .map(([key, entry]) => ({
      candidate: { key, entry },
      name: entry.teamName,
    }));

  const bestMatch = findBestTeamNameMatch(teamName, candidates);
  return bestMatch?.candidate ?? null;
}

function findEntryByCompetitionAndName(
  entryMap: Map<string, TeamSourceRegistryEntry>,
  competitionId: string | null,
  teamName: string,
): { key: string; entry: TeamSourceRegistryEntry } | null {
  const candidates = Array.from(entryMap.entries())
    .filter(([, entry]) => entry.competitionId === competitionId)
    .map(([key, entry]) => ({
      candidate: { key, entry },
      name: entry.teamName,
    }));

  const bestMatch = findBestTeamNameMatch(teamName, candidates);
  return bestMatch?.candidate ?? null;
}

function extractTeamNamesFromStandings(snapshot: CompetitionStandingsSnapshot): string[] {
  const teams = new Set<string>();

  for (const table of snapshot.tables ?? []) {
    for (const row of table.rows ?? []) {
      const teamName = String(row.teamName ?? "").trim();
      if (teamName) {
        teams.add(teamName);
      }
    }
  }

  return Array.from(teams);
}

function compareRegistryEntries(left: TeamSourceRegistryEntry, right: TeamSourceRegistryEntry): number {
  return (
    Number(right.activeInCurrentWindow) - Number(left.activeInCurrentWindow) ||
    String(left.countryName ?? "").localeCompare(String(right.countryName ?? "")) ||
    String(left.competitionName ?? "").localeCompare(String(right.competitionName ?? "")) ||
    left.teamName.localeCompare(right.teamName)
  );
}

function slugify(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

async function readJsonRequired<T>(filePath: string, missingMessage: string): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(missingMessage);
  }
}

async function readJsonOptional<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readStandingsSnapshots(
  standingsDir: string,
): Promise<Map<string, CompetitionStandingsSnapshot>> {
  const map = new Map<string, CompetitionStandingsSnapshot>();

  try {
    const files = await readdir(standingsDir);

    for (const fileName of files) {
      if (!fileName.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(standingsDir, fileName);
      const snapshot = await readJsonOptional<CompetitionStandingsSnapshot>(filePath);
      if (snapshot?.competitionId) {
        map.set(snapshot.competitionId, snapshot);
      }
    }
  } catch {
    return map;
  }

  return map;
}

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
