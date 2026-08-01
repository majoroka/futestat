import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MatchViewIndex, MatchViewIndexEntry, MatchViewSnapshot } from "../../domain/match-view.js";

export class JsonMatchViewStore {
  constructor(private readonly repoRoot: string) {}

  deriveOutputPath(matchDate: string, fixtureId: string): string {
    return path.join(this.repoRoot, "data", "match-view", matchDate, `${fixtureId}.json`);
  }

  async writeSnapshot(params: {
    snapshot: MatchViewSnapshot;
    outputPath: string;
    fixtureId: string;
    matchDate: string;
    builtAtUtc: string;
    force: boolean;
  }): Promise<{ outputPath: string; indexPath: string }> {
    await this.ensureWritableOutput(params.outputPath, params.force);
    await mkdir(path.dirname(params.outputPath), { recursive: true });
    await writeFile(params.outputPath, JSON.stringify(params.snapshot, null, 2), "utf8");

    const indexPath = path.join(this.repoRoot, "data", "match-view", "index.json");
    await this.updateIndex(indexPath, {
      fixtureId: params.fixtureId,
      matchDate: params.matchDate,
      jsonPath: toProjectRelativePath(this.repoRoot, params.outputPath),
      builtAtUtc: params.builtAtUtc,
    });

    return { outputPath: params.outputPath, indexPath };
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

  private async updateIndex(indexPath: string, entry: MatchViewIndexEntry): Promise<void> {
    const current = await this.readIndex(indexPath);
    const entries = current.entries.filter(
      (candidate) =>
        !(candidate.fixtureId === entry.fixtureId && candidate.matchDate === entry.matchDate),
    );

    entries.push(entry);
    entries.sort((left, right) => {
      return left.matchDate.localeCompare(right.matchDate) || left.fixtureId.localeCompare(right.fixtureId);
    });

    await mkdir(path.dirname(indexPath), { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify(
        {
          generatedAtUtc: entry.builtAtUtc,
          entries,
        } satisfies MatchViewIndex,
        null,
        2,
      ),
      "utf8",
    );
  }

  private async readIndex(indexPath: string): Promise<MatchViewIndex> {
    try {
      const raw = await readFile(indexPath, "utf8");
      const parsed = JSON.parse(raw) as MatchViewIndex;
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
