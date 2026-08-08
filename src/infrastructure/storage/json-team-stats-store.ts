import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TeamStatsIndex, TeamStatsIndexEntry, TeamStatsSeasonSnapshot } from "../../domain/team-stats.js";

export interface WriteTeamStatsSnapshotParams {
  snapshot: TeamStatsSeasonSnapshot;
  outputPath: string;
  sourceHtmlPath: string;
  seasonFs: string;
  competitionId: string;
  competitionSlug: string;
  sofascoreTeamId: string | null;
  teamId: string;
  teamSlug: string;
  parsedAtUtc: string;
  force: boolean;
}

export class JsonTeamStatsStore {
  constructor(private readonly repoRoot: string) {}

  async writeSnapshot(params: WriteTeamStatsSnapshotParams): Promise<{ outputPath: string; indexPath: string }> {
    await this.ensureWritableOutput(params.outputPath, params.force);
    await mkdir(path.dirname(params.outputPath), { recursive: true });
    await writeFile(params.outputPath, JSON.stringify(params.snapshot, null, 2), "utf8");

    const indexPath = path.join(this.repoRoot, "data", "team-stats", "fotmob", "index.json");
    await this.updateIndex(indexPath, {
      season: params.seasonFs,
      competitionId: params.competitionId,
      competitionSlug: params.competitionSlug,
      sofascoreTeamId: params.sofascoreTeamId,
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
    const marker = "/raw/team-pages/fotmob/";
    const index = normalized.lastIndexOf(marker);

    if (index === -1) {
      throw new Error(
        'Unable to derive output path. Expected input path inside "raw/team-pages/fotmob/".',
      );
    }

    const tail = normalized.slice(index + marker.length);
    const jsonRelative = tail.replace(/\.html$/i, ".json");
    return path.join(this.repoRoot, "data", "team-stats", "fotmob", jsonRelative);
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

  private async updateIndex(indexPath: string, entry: TeamStatsIndexEntry): Promise<void> {
    const current = await this.readIndex(indexPath);
    const entries = current.entries.filter(
      (candidate) =>
        !(
          candidate.season === entry.season &&
          candidate.competitionId === entry.competitionId &&
          candidate.teamId === entry.teamId
        ),
    );

    entries.push(entry);
    entries.sort((left, right) => {
      return (
        left.season.localeCompare(right.season) ||
        left.competitionId.localeCompare(right.competitionId) ||
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
        } satisfies TeamStatsIndex,
        null,
        2,
      ),
      "utf8",
    );
  }

  private async readIndex(indexPath: string): Promise<TeamStatsIndex> {
    try {
      const raw = await readFile(indexPath, "utf8");
      const parsed = JSON.parse(raw) as TeamStatsIndex;
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
