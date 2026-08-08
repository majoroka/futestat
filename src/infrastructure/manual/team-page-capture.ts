import path from "node:path";
import { Buffer } from "node:buffer";

import type {
  TeamPageCaptureManifestEntry,
  TeamPageCaptureSource,
} from "../../domain/team-page-capture.js";
import { JsonTeamPageCaptureStore } from "../storage/json-team-page-capture-store.js";

export interface TeamPageCaptureOptions {
  source: TeamPageCaptureSource;
  season: string;
  sofascoreTeamId?: string;
  teamId: string;
  teamSlug: string;
  url: string;
  competitionId?: string;
  competitionSlug?: string;
  countrySlug?: string;
  force: boolean;
  note?: string;
}

export interface TeamPageCaptureResult {
  source: TeamPageCaptureSource;
  season: string;
  sofascoreTeamId: string | null;
  teamId: string;
  teamSlug: string;
  htmlPath: string;
  manifestPath: string;
  url: string;
  bytes: number;
  note: string | null;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

export function validateTeamPageCaptureOptions(options: TeamPageCaptureOptions): void {
  if (!/^\d{4}-\d{4}$/.test(options.season)) {
    throw new Error(`Invalid season "${options.season}". Expected YYYY-YYYY.`);
  }

  if (!options.teamId.trim()) {
    throw new Error("teamId is required.");
  }

  if (options.sofascoreTeamId !== undefined && !/^\d+$/.test(options.sofascoreTeamId)) {
    throw new Error(
      `Invalid sofascoreTeamId "${options.sofascoreTeamId}". Expected numeric Sofascore team id.`,
    );
  }

  if (!isSafeSlug(options.teamSlug)) {
    throw new Error(
      `Invalid teamSlug "${options.teamSlug}". Expected lowercase ASCII with hyphens.`,
    );
  }

  try {
    const url = new URL(options.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid url "${options.url}".`);
  }

  if (options.source === "fotmob") {
    if (!options.competitionId?.trim()) {
      throw new Error('competitionId is required when source="fotmob".');
    }

    if (!options.competitionSlug || !isSafeSlug(options.competitionSlug)) {
      throw new Error(
        `Invalid competitionSlug "${options.competitionSlug ?? ""}" for source="fotmob".`,
      );
    }
  }

  if (options.source === "soccer-rating") {
    if (!options.countrySlug || !isSafeSlug(options.countrySlug)) {
      throw new Error(
        `Invalid countrySlug "${options.countrySlug ?? ""}" for source="soccer-rating".`,
      );
    }
  }
}

export function deriveTeamPageHtmlPath(repoRoot: string, options: TeamPageCaptureOptions): string {
  const baseDir = path.join(repoRoot, "raw", "team-pages", options.source, options.season);
  const fileName = `${options.teamId}-${options.teamSlug}.html`;

  if (options.source === "fotmob") {
    return path.join(
      baseDir,
      `${options.competitionId}-${options.competitionSlug}`,
      fileName,
    );
  }

  return path.join(baseDir, String(options.countrySlug), fileName);
}

export function buildTeamPageManifestEntry(params: {
  repoRoot: string;
  options: TeamPageCaptureOptions;
  htmlPath: string;
  finalUrl?: string;
  capturedAtUtc: string;
}): TeamPageCaptureManifestEntry {
  const { repoRoot, options, htmlPath, capturedAtUtc } = params;

  return {
    source: options.source,
    season: options.season,
    sofascoreTeamId: options.sofascoreTeamId ?? null,
    teamId: options.teamId,
    teamSlug: options.teamSlug,
    competitionId: options.source === "fotmob" ? String(options.competitionId) : null,
    competitionSlug: options.source === "fotmob" ? String(options.competitionSlug) : null,
    countrySlug: options.source === "soccer-rating" ? String(options.countrySlug) : null,
    url: params.finalUrl ?? options.url,
    htmlPath: toProjectRelativePath(repoRoot, htmlPath),
    capturedAtUtc,
  };
}

export async function captureTeamPage(
  repoRoot: string,
  options: TeamPageCaptureOptions,
): Promise<TeamPageCaptureResult> {
  validateTeamPageCaptureOptions(options);

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

  return {
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
  };
}

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
