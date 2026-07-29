import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CompetitionStandingsSnapshot } from "../../domain/competition-standings.js";

export class JsonCompetitionStandingsStore {
  constructor(private readonly outputDir: string) {}

  async read(competitionId: string): Promise<CompetitionStandingsSnapshot | null> {
    try {
      const raw = await readFile(this.snapshotPath(competitionId), "utf8");
      return JSON.parse(raw) as CompetitionStandingsSnapshot;
    } catch {
      return null;
    }
  }

  async write(snapshot: CompetitionStandingsSnapshot): Promise<string> {
    const filePath = this.snapshotPath(snapshot.competitionId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
    return filePath;
  }

  isFresh(params: {
    snapshot: CompetitionStandingsSnapshot;
    maxAgeHours: number;
    now?: Date;
  }): boolean {
    const now = params.now ?? new Date();
    const scrapedAtMs = Date.parse(params.snapshot.scrapedAtUtc);

    if (Number.isNaN(scrapedAtMs)) {
      return false;
    }

    if (!Array.isArray(params.snapshot.tables) || params.snapshot.tables.length === 0) {
      return false;
    }

    return now.getTime() - scrapedAtMs <= params.maxAgeHours * 60 * 60 * 1_000;
  }

  private snapshotPath(competitionId: string): string {
    return path.join(this.outputDir, `${competitionId}.json`);
  }
}
