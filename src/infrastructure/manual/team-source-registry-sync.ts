import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MatchFixture, PublicFixtureSnapshot } from "../../domain/fixture.js";
import type {
  TeamSourceRegistry,
  TeamSourceRegistryEntry,
} from "../../domain/team-source-registry.js";

export interface SyncTeamSourceRegistryOptions {
  snapshotPath?: string;
  registryPath?: string;
}

export interface SyncTeamSourceRegistryResult {
  registryPath: string;
  totalEntries: number;
  activeEntries: number;
  addedEntries: number;
  retainedEntries: number;
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

  const snapshot = await readJsonRequired<PublicFixtureSnapshot>(
    snapshotPath,
    `Public fixture snapshot not found at ${snapshotPath}.`,
  );
  const existing = await readJsonOptional<TeamSourceRegistry>(registryPath);
  const existingMap = new Map<string, TeamSourceRegistryEntry>();

  for (const entry of existing?.entries ?? []) {
    const key = buildTeamKey(entry.sofascoreTeamId, entry.teamName);
    existingMap.set(key, {
      ...entry,
      activeInCurrentWindow: false,
      fixtureAppearancesInCurrentWindow: 0,
    });
  }

  let addedEntries = 0;

  for (const fixture of snapshot.fixtures) {
    upsertFixtureTeam(existingMap, snapshot.referenceDate, fixture, "home");
    upsertFixtureTeam(existingMap, snapshot.referenceDate, fixture, "away");
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
      competitionName: entry.competitionName,
      countryName: entry.countryName,
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
  };
}

function upsertFixtureTeam(
  entryMap: Map<string, TeamSourceRegistryEntry>,
  referenceDate: string,
  fixture: MatchFixture,
  side: "home" | "away",
): void {
  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const teamName = side === "home" ? fixture.homeTeamName : fixture.awayTeamName;
  const key = buildTeamKey(teamId, teamName);
  const existing = entryMap.get(key);

  if (existing) {
    existing.activeInCurrentWindow = true;
    existing.fixtureAppearancesInCurrentWindow += 1;
    existing.lastSeenReferenceDate = referenceDate;
    existing.teamName = teamName;
    existing.countryName = fixture.countryName;
    existing.competitionId = fixture.competitionId;
    existing.competitionName = fixture.competitionName;
    seedDefaultSourceHints(existing, fixture);
    return;
  }

  const created = createRegistryEntry({
    referenceDate,
    teamId,
    teamName,
    competitionId: fixture.competitionId,
    competitionName: fixture.competitionName,
    countryName: fixture.countryName,
  });
  seedDefaultSourceHints(created, fixture);
  entryMap.set(key, created);
}

function createRegistryEntry(params: {
  referenceDate: string;
  teamId: string | null;
  teamName: string;
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
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
    activeInCurrentWindow: true,
    fixtureAppearancesInCurrentWindow: 1,
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

function buildTeamKey(teamId: string | null, teamName: string): string {
  if (teamId) {
    return `id:${teamId}`;
  }

  return `name:${normalizeToken(teamName)}`;
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

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
