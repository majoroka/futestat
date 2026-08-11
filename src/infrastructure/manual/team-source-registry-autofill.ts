import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  TeamSourceRegistry,
  TeamSourceRegistryEntry,
  TeamSourceRegistryFotmobSource,
  TeamSourceRegistrySoccerRatingSource,
} from "../../domain/team-source-registry.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const NON_DISTINCTIVE_TOKENS = new Set([
  "ac",
  "afc",
  "athletic",
  "atletico",
  "bk",
  "ca",
  "cd",
  "cf",
  "club",
  "cp",
  "csa",
  "de",
  "del",
  "deportivo",
  "do",
  "fc",
  "fk",
  "football",
  "futebol",
  "if",
  "jk",
  "sc",
  "sd",
  "sk",
  "sv",
  "the",
  "ud",
]);

const STRUCTURAL_TOKENS = new Set([
  "a",
  "b",
  "ii",
  "iii",
  "iv",
  "u17",
  "u18",
  "u19",
  "u20",
  "u21",
  "u23",
  "w",
  "women",
  "woman",
  "female",
  "feminino",
  "feminina",
  "reserves",
  "reserve",
]);

const TOKEN_ALIASES = new Map<string, string>([
  ["jrs", "juniors"],
  ["jr", "juniors"],
  ["utd", "united"],
  ["dep", "deportivo"],
  ["def", "defensa"],
  ["st", "saint"],
  ["saint", "saint"],
  ["int", "internacional"],
]);

const COUNTRY_CODES_BY_NAME = new Map<string, string>([
  ["argentina", "AR"],
  ["austria", "AT"],
  ["belgium", "BE"],
  ["belgica", "BE"],
  ["brazil", "BR"],
  ["brasil", "BR"],
  ["bulgaria", "BG"],
  ["bulgaria", "BG"],
  ["croatia", "HR"],
  ["dinamarca", "DK"],
  ["denmark", "DK"],
  ["england", "EN"],
  ["escotia", "SC"],
  ["finland", "FI"],
  ["finlandia", "FI"],
  ["france", "FR"],
  ["germany", "DE"],
  ["greece", "GR"],
  ["grecia", "GR"],
  ["hungary", "HU"],
  ["hungria", "HU"],
  ["israel", "IL"],
  ["italy", "IT"],
  ["netherlands", "NL"],
  ["noruega", "NO"],
  ["norway", "NO"],
  ["poland", "PL"],
  ["polonia", "PL"],
  ["portugal", "PT"],
  ["romania", "RO"],
  ["russia", "RU"],
  ["russia", "RU"],
  ["scotland", "SC"],
  ["serbia", "RS"],
  ["slovakia", "SK"],
  ["slovenia", "SI"],
  ["spain", "ES"],
  ["suica", "CH"],
  ["sweden", "SE"],
  ["suecia", "SE"],
  ["switzerland", "CH"],
  ["turkey", "TR"],
  ["turquia", "TR"],
  ["ukraine", "UA"],
  ["united kingdom", "GB"],
  ["czech republic", "CZ"],
  ["republica checa", "CZ"],
]);

interface NameProfile {
  strict: string;
  compact: string;
  canonicalCompact: string;
  canonicalTokens: string[];
  distinctiveTokens: string[];
  structuralTokens: string[];
}

export interface AutofillTeamSourceRegistryOptions {
  registryPath?: string;
  source?: "all" | "fotmob" | "soccer-rating";
  dryRun?: boolean;
  onlyPending?: boolean;
  competitionIds?: Set<string> | null;
  teamId?: string;
  limit?: number;
  delayMs?: number;
}

export interface AutofillTeamSourceRegistryResult {
  registryPath: string;
  totalEntries: number;
  processedEntries: number;
  sourceSummaries: {
    fotmob: AutofillSourceSummary;
    soccerRating: AutofillSourceSummary;
  };
}

export interface AutofillSourceSummary {
  considered: number;
  attempted: number;
  mapped: number;
  unresolved: number;
  skipped: number;
}

interface CandidateBase {
  sourceTeamId: string;
  rawName: string;
  profile: NameProfile;
  competitionName: string | null;
  rank: number;
}

interface FotmobCandidate extends CandidateBase {
  teamSlug: string;
  url: string;
}

interface SoccerRatingCandidate extends CandidateBase {
  sourceSlug: string;
  teamSlug: string;
  url: string;
  countryCode: string | null;
}

interface ScoredCandidate<TCandidate> {
  candidate: TCandidate;
  score: number;
  reasons: string[];
}

interface SearchRuntime {
  delayMs: number;
  lastRequestAtMs: number;
}

interface FotmobSuggestResponse {
  teamSuggest?: Array<{
    text?: string;
    options?: Array<{
      text?: string;
      payload?: {
        id?: string;
        leagueName?: string;
      };
    }>;
  }>;
  matchSuggest?: Array<{
    options?: Array<{
      payload?: {
        homeTeamId?: string;
        awayTeamId?: string;
        homeName?: string;
        awayName?: string;
        leagueName?: string;
      };
    }>;
  }>;
}

export async function autofillTeamSourceRegistry(
  repoRoot: string,
  options: AutofillTeamSourceRegistryOptions,
): Promise<AutofillTeamSourceRegistryResult> {
  const registryPath = path.resolve(
    repoRoot,
    options.registryPath ?? path.join("data", "team-source-registry.json"),
  );
  const registry = await readRegistry(registryPath);
  const runtime: SearchRuntime = {
    delayMs: Math.max(0, options.delayMs ?? 600),
    lastRequestAtMs: 0,
  };
  const source = options.source ?? "all";
  const onlyPending = options.onlyPending ?? true;
  const competitionIds = options.competitionIds ?? null;
  const teamIdFilter = options.teamId?.trim() || null;
  const limit = options.limit && options.limit > 0 ? options.limit : null;

  const sourceSummaries = {
    fotmob: createSummary(),
    soccerRating: createSummary(),
  };

  let processedEntries = 0;

  for (const entry of registry.entries) {
    if (competitionIds && !competitionIds.has(String(entry.competitionId ?? ""))) {
      continue;
    }

    if (teamIdFilter && entry.sofascoreTeamId !== teamIdFilter) {
      continue;
    }

    if (limit !== null && processedEntries >= limit) {
      break;
    }

    processedEntries += 1;

    if (source === "all" || source === "fotmob") {
      sourceSummaries.fotmob.considered += 1;
      const processed = await autofillFotmobForEntry(entry, runtime, { onlyPending });
      accumulateSummary(sourceSummaries.fotmob, processed);
    }

    if (source === "all" || source === "soccer-rating") {
      sourceSummaries.soccerRating.considered += 1;
      const processed = await autofillSoccerRatingForEntry(entry, runtime, { onlyPending });
      accumulateSummary(sourceSummaries.soccerRating, processed);
    }
  }

  registry.generatedAtUtc = new Date().toISOString();
  if (!options.dryRun) {
    await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");
  }

  return {
    registryPath,
    totalEntries: registry.entries.length,
    processedEntries,
    sourceSummaries,
  };
}

export function extractFotmobCandidates(payload: FotmobSuggestResponse): FotmobCandidate[] {
  const candidates = new Map<string, FotmobCandidate>();
  let rank = 0;

  for (const group of payload.teamSuggest ?? []) {
    for (const option of group.options ?? []) {
      const teamId = String(option.payload?.id ?? "").trim();
      if (!teamId) {
        continue;
      }

      const rawName = String(option.text ?? group.text ?? "").split("|")[0]?.trim();
      if (!rawName) {
        continue;
      }

      candidates.set(teamId, {
        sourceTeamId: teamId,
        rawName,
        profile: buildNameProfile(rawName),
        competitionName: option.payload?.leagueName?.trim() ?? null,
        rank,
        teamSlug: slugify(rawName),
        url: `https://www.fotmob.com/teams/${teamId}/stats/${slugify(rawName)}/teams`,
      });
      rank += 1;
    }
  }

  for (const group of payload.matchSuggest ?? []) {
    for (const option of group.options ?? []) {
      const competitionName = option.payload?.leagueName?.trim() ?? null;
      const fixtures = [
        {
          teamId: String(option.payload?.homeTeamId ?? "").trim(),
          rawName: String(option.payload?.homeName ?? "").trim(),
        },
        {
          teamId: String(option.payload?.awayTeamId ?? "").trim(),
          rawName: String(option.payload?.awayName ?? "").trim(),
        },
      ];

      for (const fixtureTeam of fixtures) {
        if (!fixtureTeam.teamId || !fixtureTeam.rawName || candidates.has(fixtureTeam.teamId)) {
          continue;
        }

        candidates.set(fixtureTeam.teamId, {
          sourceTeamId: fixtureTeam.teamId,
          rawName: fixtureTeam.rawName,
          profile: buildNameProfile(fixtureTeam.rawName),
          competitionName,
          rank,
          teamSlug: slugify(fixtureTeam.rawName),
          url: `https://www.fotmob.com/teams/${fixtureTeam.teamId}/stats/${slugify(fixtureTeam.rawName)}/teams`,
        });
        rank += 1;
      }
    }
  }

  return Array.from(candidates.values());
}

export function extractSoccerRatingCandidates(html: string): SoccerRatingCandidate[] {
  const candidates = new Map<string, SoccerRatingCandidate>();
  const rowRegex =
    /<tr>\s*<td>\s*<a[^>]+href="\/([^"/]+)\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td>\s*<img[^>]+flags\/([A-Z]{2})\.gif/gi;
  let rank = 0;

  for (const match of html.matchAll(rowRegex)) {
    const sourceSlug = String(match[1] ?? "").trim();
    const sourceTeamId = String(match[2] ?? "").trim();
    const rawLabel = stripHtml(match[3] ?? "");
    const countryCode = String(match[4] ?? "").trim().toUpperCase() || null;

    if (!sourceSlug || !sourceTeamId || !rawLabel) {
      continue;
    }

    candidates.set(sourceTeamId, {
      sourceTeamId,
      sourceSlug,
      rawName: rawLabel,
      profile: buildNameProfile(rawLabel),
      competitionName: null,
      rank,
      teamSlug: slugify(rawLabel),
      url: `https://www.soccer-rating.com/${sourceSlug}/${sourceTeamId}/`,
      countryCode,
    });
    rank += 1;
  }

  return Array.from(candidates.values());
}

export function chooseBestFotmobCandidate(
  entry: TeamSourceRegistryEntry,
  candidates: FotmobCandidate[],
): ScoredCandidate<FotmobCandidate> | null {
  return chooseBestCandidate(
    buildNameProfile(entry.teamName),
    candidates,
    (candidate) => scoreFotmobCandidate(entry, candidate),
  );
}

export function chooseBestSoccerRatingCandidate(
  entry: TeamSourceRegistryEntry,
  candidates: SoccerRatingCandidate[],
): ScoredCandidate<SoccerRatingCandidate> | null {
  return chooseBestCandidate(
    buildNameProfile(entry.teamName),
    candidates,
    (candidate) => scoreSoccerRatingCandidate(entry, candidate),
  );
}

function createSummary(): AutofillSourceSummary {
  return {
    considered: 0,
    attempted: 0,
    mapped: 0,
    unresolved: 0,
    skipped: 0,
  };
}

function accumulateSummary(summary: AutofillSourceSummary, processed: ProcessedAttempt): void {
  if (!processed.attempted) {
    summary.skipped += 1;
    return;
  }

  summary.attempted += 1;
  if (processed.mapped) {
    summary.mapped += 1;
    return;
  }

  summary.unresolved += 1;
}

interface ProcessedAttempt {
  attempted: boolean;
  mapped: boolean;
}

async function autofillFotmobForEntry(
  entry: TeamSourceRegistryEntry,
  runtime: SearchRuntime,
  options: { onlyPending: boolean },
): Promise<ProcessedAttempt> {
  const source = entry.sources.fotmob;
  if (shouldSkipSource(source.status, options.onlyPending)) {
    return {
      attempted: false,
      mapped: source.status === "mapped",
    };
  }

  const candidates = await collectFotmobCandidates(entry, runtime);
  if (candidates.length === 0) {
    source.notes = "autofill: sem candidatos FotMob";
    return { attempted: true, mapped: false };
  }

  const best = chooseBestFotmobCandidate(entry, candidates);
  if (!best) {
    source.notes = "autofill: match FotMob inconclusivo";
    return { attempted: true, mapped: false };
  }

  applyFotmobMapping(source, best.candidate);
  return { attempted: true, mapped: true };
}

async function autofillSoccerRatingForEntry(
  entry: TeamSourceRegistryEntry,
  runtime: SearchRuntime,
  options: { onlyPending: boolean },
): Promise<ProcessedAttempt> {
  const source = entry.sources.soccerRating;
  if (shouldSkipSource(source.status, options.onlyPending)) {
    return {
      attempted: false,
      mapped: source.status === "mapped",
    };
  }

  const candidates = await collectSoccerRatingCandidates(entry, runtime);
  if (candidates.length === 0) {
    source.notes = "autofill: sem candidatos Soccer-Rating";
    return { attempted: true, mapped: false };
  }

  const best = chooseBestSoccerRatingCandidate(entry, candidates);
  if (!best) {
    source.notes = "autofill: match Soccer-Rating inconclusivo";
    return { attempted: true, mapped: false };
  }

  applySoccerRatingMapping(source, best.candidate);
  return { attempted: true, mapped: true };
}

function applyFotmobMapping(
  source: TeamSourceRegistryFotmobSource,
  candidate: FotmobCandidate,
): void {
  source.status = "mapped";
  source.sourceTeamId = candidate.sourceTeamId;
  source.teamSlug = candidate.teamSlug;
  source.url = candidate.url;
  source.notes = null;
}

function applySoccerRatingMapping(
  source: TeamSourceRegistrySoccerRatingSource,
  candidate: SoccerRatingCandidate,
): void {
  source.status = "mapped";
  source.sourceTeamId = candidate.sourceTeamId;
  source.teamSlug = candidate.teamSlug;
  source.url = candidate.url;
  source.notes = null;
}

async function collectFotmobCandidates(
  entry: TeamSourceRegistryEntry,
  runtime: SearchRuntime,
): Promise<FotmobCandidate[]> {
  const combined = new Map<string, FotmobCandidate>();

  for (const query of buildSearchQueries(entry.teamName)) {
    const response = await fetchJson<FotmobSuggestResponse>(
      `https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(query)}&lang=en`,
      runtime,
      {
        accept: "application/json",
      },
    );
    for (const candidate of extractFotmobCandidates(response)) {
      combined.set(candidate.sourceTeamId, candidate);
    }

    const best = chooseBestFotmobCandidate(entry, Array.from(combined.values()));
    if (best) {
      return Array.from(combined.values());
    }
  }

  return Array.from(combined.values());
}

async function collectSoccerRatingCandidates(
  entry: TeamSourceRegistryEntry,
  runtime: SearchRuntime,
): Promise<SoccerRatingCandidate[]> {
  const combined = new Map<string, SoccerRatingCandidate>();

  for (const query of buildSearchQueries(entry.teamName)) {
    const html = await fetchText(
      `https://www.soccer-rating.com/search.php?search=${encodeURIComponent(query)}`,
      runtime,
    );
    for (const candidate of extractSoccerRatingCandidates(html)) {
      combined.set(candidate.sourceTeamId, candidate);
    }

    const best = chooseBestSoccerRatingCandidate(entry, Array.from(combined.values()));
    if (best) {
      return Array.from(combined.values());
    }
  }

  return Array.from(combined.values());
}

async function fetchJson<TResponse>(
  url: string,
  runtime: SearchRuntime,
  extraHeaders?: Record<string, string>,
): Promise<TResponse> {
  const response = await request(url, runtime, extraHeaders);
  return (await response.json()) as TResponse;
}

async function fetchText(url: string, runtime: SearchRuntime): Promise<string> {
  const response = await request(url, runtime);
  return response.text();
}

async function request(
  url: string,
  runtime: SearchRuntime,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  await respectDelay(runtime);

  const response = await fetch(url, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      ...extraHeaders,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  runtime.lastRequestAtMs = Date.now();

  if (response.status === 403) {
    throw new Error(`Remote request blocked with HTTP 403 for ${url}.`);
  }

  if (!response.ok) {
    throw new Error(`Remote request failed for ${url}. HTTP ${response.status} ${response.statusText}.`);
  }

  return response;
}

async function respectDelay(runtime: SearchRuntime): Promise<void> {
  if (runtime.delayMs <= 0 || runtime.lastRequestAtMs <= 0) {
    return;
  }

  const waitMs = runtime.delayMs - (Date.now() - runtime.lastRequestAtMs);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function shouldSkipSource(
  status: TeamSourceRegistryFotmobSource["status"] | TeamSourceRegistrySoccerRatingSource["status"],
  onlyPending: boolean,
): boolean {
  if (status === "not_applicable") {
    return true;
  }

  return onlyPending && status === "mapped";
}

function buildSearchQueries(teamName: string): string[] {
  const normalized = teamName.replace(/[().]/g, " ").replace(/\s+/g, " ").trim();
  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const canonicalTokens = rawTokens
    .map((token) => canonicalizeToken(token))
    .filter(Boolean)
    .filter((token) => !NON_DISTINCTIVE_TOKENS.has(token) && !STRUCTURAL_TOKENS.has(token));

  const longestTokens = [...canonicalTokens].sort((left, right) => right.length - left.length);
  const queries = [
    teamName,
    normalized,
    canonicalTokens.join(" "),
    rawTokens.slice(0, 2).join(" "),
    rawTokens.slice(-2).join(" "),
    longestTokens.slice(0, 2).join(" "),
    longestTokens[0] ?? "",
    longestTokens[1] ?? "",
  ];

  const deduped = new Set<string>();
  for (const query of queries) {
    const clean = query.replace(/\s+/g, " ").trim();
    if (clean.length >= 3) {
      deduped.add(clean);
    }
    if (deduped.size >= 4) {
      break;
    }
  }

  return Array.from(deduped);
}

function chooseBestCandidate<TCandidate extends CandidateBase>(
  entryProfile: NameProfile,
  candidates: TCandidate[],
  scorer: (candidate: TCandidate) => ScoredCandidate<TCandidate>,
): ScoredCandidate<TCandidate> | null {
  if (candidates.length === 0) {
    return null;
  }

  const scored = candidates
    .map((candidate) => scorer(candidate))
    .sort((left, right) => right.score - left.score);

  const [best, second] = scored;
  if (!best) {
    return null;
  }

  const exactMatch =
    best.candidate.profile.strict === entryProfile.strict ||
    best.candidate.profile.canonicalCompact === entryProfile.canonicalCompact;
  const threshold = exactMatch ? 0.84 : 0.9;
  const gap = second ? best.score - second.score : best.score;

  if (best.score < threshold) {
    return null;
  }

  if (!exactMatch && gap < 0.08) {
    return null;
  }

  return best;
}

function scoreFotmobCandidate(
  entry: TeamSourceRegistryEntry,
  candidate: FotmobCandidate,
): ScoredCandidate<FotmobCandidate> {
  const base = scoreNameProfiles(buildNameProfile(entry.teamName), candidate.profile);
  const reasons = [...base.reasons];
  let score = base.score;

  score += Math.max(0, 0.04 - candidate.rank * 0.005);

  if (
    buildNameProfile(entry.teamName).distinctiveTokens.length === 1 &&
    buildNameProfile(entry.teamName).distinctiveTokens[0] &&
    buildNameProfile(entry.teamName).distinctiveTokens[0]!.length >= 6 &&
    candidate.rank === 0
  ) {
    score += 0.06;
    reasons.push("top-ranked-search-result");
  }

  if (candidate.competitionName && entry.competitionName) {
    const competitionSimilarity = measureStringSimilarity(
      buildNameProfile(entry.competitionName).canonicalCompact,
      buildNameProfile(candidate.competitionName).canonicalCompact,
    );
    if (competitionSimilarity >= 0.85) {
      score += 0.04;
      reasons.push("competition-match");
    }
  }

  return {
    candidate,
    score: Math.min(score, 1.2),
    reasons,
  };
}

function scoreSoccerRatingCandidate(
  entry: TeamSourceRegistryEntry,
  candidate: SoccerRatingCandidate,
): ScoredCandidate<SoccerRatingCandidate> {
  const base = scoreNameProfiles(buildNameProfile(entry.teamName), candidate.profile);
  const reasons = [...base.reasons];
  let score = base.score;

  score += Math.max(0, 0.06 - candidate.rank * 0.01);

  if (
    buildNameProfile(entry.teamName).distinctiveTokens.length === 1 &&
    buildNameProfile(entry.teamName).distinctiveTokens[0] &&
    buildNameProfile(entry.teamName).distinctiveTokens[0]!.length >= 6 &&
    candidate.rank === 0
  ) {
    score += 0.1;
    reasons.push("top-ranked-search-result");
  }

  const expectedCountryCode = resolveCountryCode(entry.countryName);
  if (expectedCountryCode && candidate.countryCode) {
    if (expectedCountryCode === candidate.countryCode) {
      score += 0.06;
      reasons.push("country-match");
    } else {
      score -= 0.08;
      reasons.push("country-mismatch");
    }
  }

  return {
    candidate,
    score: Math.min(score, 1.2),
    reasons,
  };
}

function scoreNameProfiles(
  target: NameProfile,
  candidate: NameProfile,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (target.strict && target.strict === candidate.strict) {
    score += 1;
    reasons.push("strict-match");
  }

  if (
    target.canonicalCompact &&
    target.canonicalCompact === candidate.canonicalCompact &&
    target.canonicalCompact.length >= 4
  ) {
    score += 0.92;
    reasons.push("canonical-match");
  }

  const canonicalSimilarity = measureStringSimilarity(
    target.canonicalCompact,
    candidate.canonicalCompact,
  );
  score += canonicalSimilarity * 0.55;
  if (canonicalSimilarity >= 0.9) {
    reasons.push("canonical-similar");
  }

  const overlap = measureTokenOverlap(target.distinctiveTokens, candidate.distinctiveTokens);
  score += overlap.coverage * 0.32 + overlap.jaccard * 0.2;
  if (overlap.coverage >= 0.9) {
    reasons.push("token-coverage");
  }

  if (
    target.distinctiveTokens.length === 1 &&
    target.distinctiveTokens[0] &&
    target.distinctiveTokens[0].length >= 6 &&
    candidate.distinctiveTokens.includes(target.distinctiveTokens[0]) &&
    candidate.distinctiveTokens.length <= 2
  ) {
    score += 0.22;
    reasons.push("single-token-club-match");
  }

  const targetHasStructural = target.structuralTokens.length > 0;
  const candidateHasStructural = candidate.structuralTokens.length > 0;
  if (!targetHasStructural && candidateHasStructural) {
    score -= 0.25;
    reasons.push("structural-penalty");
  }

  if (
    target.distinctiveTokens.length > 0 &&
    candidate.distinctiveTokens.length > 0 &&
    overlap.sharedCount === 0
  ) {
    score -= 0.2;
    reasons.push("no-token-overlap");
  }

  return {
    score,
    reasons,
  };
}

function buildNameProfile(value: string): NameProfile {
  const strict = normalizeStrict(value);
  const compact = compactString(value);
  const canonicalTokens = tokenize(value).map((token) => canonicalizeToken(token)).filter(Boolean);
  const structuralTokens = canonicalTokens.filter((token) => STRUCTURAL_TOKENS.has(token));
  const distinctiveTokens = canonicalTokens.filter(
    (token) => !NON_DISTINCTIVE_TOKENS.has(token) && !STRUCTURAL_TOKENS.has(token),
  );

  return {
    strict,
    compact,
    canonicalCompact: distinctiveTokens.join(""),
    canonicalTokens,
    distinctiveTokens,
    structuralTokens,
  };
}

function normalizeStrict(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactString(value: string): string {
  return normalizeStrict(value).replace(/\s+/g, "");
}

function tokenize(value: string): string[] {
  return normalizeStrict(value)
    .split(/\s+/)
    .filter(Boolean);
}

function canonicalizeToken(token: string): string {
  return TOKEN_ALIASES.get(token) ?? token;
}

function measureStringSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const leftBigrams = createNgrams(left, 2);
  const rightBigrams = createNgrams(right, 2);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftBigrams) {
    if (rightBigrams.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftBigrams.size, rightBigrams.size);
}

function createNgrams(value: string, length: number): Set<string> {
  const grams = new Set<string>();
  if (value.length < length) {
    return grams;
  }

  for (let index = 0; index <= value.length - length; index += 1) {
    grams.add(value.slice(index, index + length));
  }

  return grams;
}

function measureTokenOverlap(
  left: string[],
  right: string[],
): { sharedCount: number; coverage: number; jaccard: number } {
  if (left.length === 0 || right.length === 0) {
    return {
      sharedCount: 0,
      coverage: 0,
      jaccard: 0,
    };
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let sharedCount = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      sharedCount += 1;
    }
  }

  return {
    sharedCount,
    coverage: sharedCount / leftSet.size,
    jaccard: sharedCount / new Set([...leftSet, ...rightSet]).size,
  };
}

function resolveCountryCode(countryName: string | null): string | null {
  const normalized = slugify(countryName ?? "").replace(/-/g, " ");
  if (!normalized || normalized === "europe" || normalized === "international") {
    return null;
  }

  return COUNTRY_CODES_BY_NAME.get(normalized) ?? null;
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

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", "\"")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&aacute;", "á")
    .replaceAll("&eacute;", "é")
    .replaceAll("&iacute;", "í")
    .replaceAll("&oacute;", "ó")
    .replaceAll("&uacute;", "ú");
}

async function readRegistry(registryPath: string): Promise<TeamSourceRegistry> {
  const raw = await readFile(registryPath, "utf8");
  return JSON.parse(raw) as TeamSourceRegistry;
}
