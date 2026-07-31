import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  TeamPageCaptureManifest,
  TeamPageCaptureManifestEntry,
} from "../../domain/team-page-capture.js";

export class JsonTeamPageCaptureStore {
  constructor(private readonly repoRoot: string) {}

  manifestPath(): string {
    return path.join(this.repoRoot, "raw", "team-pages", "manifest.json");
  }

  async ensureWritableOutput(htmlPath: string, force: boolean): Promise<void> {
    try {
      await access(htmlPath);
      if (!force) {
        throw new Error(`Output file already exists: ${htmlPath}. Use --force=true to overwrite.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Output file already exists:")) {
        throw error;
      }
    }
  }

  async writeHtml(htmlPath: string, html: string): Promise<void> {
    await mkdir(path.dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html, "utf8");
  }

  async updateManifest(entry: TeamPageCaptureManifestEntry): Promise<string> {
    const manifestPath = this.manifestPath();
    const manifest = await this.readManifest();
    const entries = manifest.entries.filter((candidate) => !isSameCaptureEntry(candidate, entry));

    entries.push(entry);
    entries.sort((left, right) => {
      return (
        left.source.localeCompare(right.source) ||
        left.season.localeCompare(right.season) ||
        compareNullable(left.competitionId, right.competitionId) ||
        compareNullable(left.countrySlug, right.countrySlug) ||
        left.teamId.localeCompare(right.teamId)
      );
    });

    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          generatedAtUtc: entry.capturedAtUtc,
          entries,
        } satisfies TeamPageCaptureManifest,
        null,
        2,
      ),
      "utf8",
    );

    return manifestPath;
  }

  private async readManifest(): Promise<TeamPageCaptureManifest> {
    try {
      const raw = await readFile(this.manifestPath(), "utf8");
      const parsed = JSON.parse(raw) as TeamPageCaptureManifest;
      return {
        generatedAtUtc: parsed.generatedAtUtc,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch {
      return {
        generatedAtUtc: new Date(0).toISOString(),
        entries: [],
      };
    }
  }
}

function isSameCaptureEntry(
  left: TeamPageCaptureManifestEntry,
  right: TeamPageCaptureManifestEntry,
): boolean {
  return (
    left.source === right.source &&
    left.season === right.season &&
    left.teamId === right.teamId &&
    left.teamSlug === right.teamSlug &&
    left.competitionId === right.competitionId &&
    left.countrySlug === right.countrySlug
  );
}

function compareNullable(left: string | null, right: string | null): number {
  return String(left ?? "").localeCompare(String(right ?? ""));
}
