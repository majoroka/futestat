import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MatchFixture } from "../../domain/fixture.js";
import type { MatchDetailSnapshot } from "../../domain/match-detail.js";

export class JsonMatchDetailStore {
  constructor(private readonly outputDir: string) {}

  async read(sourceEventId: string): Promise<MatchDetailSnapshot | null> {
    try {
      const raw = await readFile(this.detailPath(sourceEventId), "utf8");
      return JSON.parse(raw) as MatchDetailSnapshot;
    } catch {
      return null;
    }
  }

  async write(detail: MatchDetailSnapshot): Promise<string> {
    const filePath = this.detailPath(detail.sourceEventId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(detail, null, 2), "utf8");
    return filePath;
  }

  isFresh(params: {
    detail: MatchDetailSnapshot;
    fixture: MatchFixture;
    maxAgeHours: number;
    now?: Date;
  }): boolean {
    const { detail, fixture, maxAgeHours } = params;
    const now = params.now ?? new Date();
    const scrapedAtMs = Date.parse(detail.scrapedAtUtc);

    if (Number.isNaN(scrapedAtMs)) {
      return false;
    }

    if (detail.fixtureLastChangedAtUtc !== fixture.lastChangedAtUtc) {
      return false;
    }

    return now.getTime() - scrapedAtMs <= maxAgeHours * 60 * 60 * 1_000;
  }

  private detailPath(sourceEventId: string): string {
    return path.join(this.outputDir, `${sourceEventId}.json`);
  }
}
