import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  TeamContextIndex,
  TeamContextIndexEntry,
  TeamContextSnapshot,
} from "../../domain/team-context.js";

export interface WriteTeamContextSnapshotParams {
  snapshot: TeamContextSnapshot;
  outputPath: string;
  sourceHtmlPath: string;
  seasonFs: string;
  countrySlug: string;
  teamId: string;
  teamSlug: string;
  parsedAtUtc: string;
  force: boolean;
}

export class JsonTeamContextStore {
  constructor(private readonly repoRoot: string) {}

  async writeSnapshot(
    params: WriteTeamContextSnapshotParams,
  ): Promise<{ outputPath: string; indexPath: string }> {
    await this.ensureWritableOutput(params.outputPath, params.force);
    await mkdir(path.dirname(params.outputPath), { recursive: true });
    await writeFile(params.outputPath, JSON.stringify(params.snapshot, null, 2), "utf8");

    const indexPath = path.join(
      this.repoRoot,
      "data",
      "team-context",
      "soccer-rating",
      "index.json",
    );
    await this.updateIndex(indexPath, {
      season: params.seasonFs,
      countrySlug: params.countrySlug,
      teamId: params.teamId,
      teamSlug: params.teamSlug,
      jsonPath: toProjectRelativePath(this.repoRoot, params.outputPath),
      sourceHtmlPath: toProjectRelativePath(this.repoRoot, params.sourceHtmlPath),
      parsedAtUtc: params.parsedAtUtc,
      availabilityStatus: params.snapshot.availability.status,
    });

    return { outputPath: params.outputPath, indexPath };
  }

  deriveOutputPath(inputPath: string): string {
    const normalized = inputPath.replaceAll("\\", "/");
    const marker = "/raw/team-pages/soccer-rating/";
    const index = normalized.lastIndexOf(marker);

    if (index === -1) {
      throw new Error(
        'Unable to derive output path. Expected input path inside "raw/team-pages/soccer-rating/".',
      );
    }

    const tail = normalized.slice(index + marker.length);
    const jsonRelative = tail.replace(/\.html$/i, ".json");
    return path.join(this.repoRoot, "data", "team-context", "soccer-rating", jsonRelative);
  }

  private async ensureWritableOutput(outputPath: string, force: boolean): Promise<void> {
    try {
      await access(outputPath);
      if (!force) {
        throw new Error(`Output file already exists: ${outputPath}. Use --force=true to overwrite.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Output file already exists:")) {
        throw error;
      }
    }
  }

  private async updateIndex(indexPath: string, entry: TeamContextIndexEntry): Promise<void> {
    const current = await this.readIndex(indexPath);
    const entries = current.entries.filter(
      (candidate) =>
        !(
          candidate.season === entry.season &&
          candidate.countrySlug === entry.countrySlug &&
          candidate.teamId === entry.teamId
        ),
    );

    entries.push(entry);
    entries.sort((left, right) => {
      return (
        left.season.localeCompare(right.season) ||
        left.countrySlug.localeCompare(right.countrySlug) ||
        left.teamId.localeCompare(right.teamId)
      );
    });

    await mkdir(path.dirname(indexPath), { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify(
        {
          generatedAtUtc: entry.parsedAtUtc,
          entries,
        } satisfies TeamContextIndex,
        null,
        2,
      ),
      "utf8",
    );
  }

  private async readIndex(indexPath: string): Promise<TeamContextIndex> {
    try {
      const raw = await readFile(indexPath, "utf8");
      const parsed = JSON.parse(raw) as TeamContextIndex;
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

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
