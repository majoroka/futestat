import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FixtureSnapshot } from "../../domain/fixture.js";

export class JsonFixtureStore {
  constructor(private readonly outputDir: string) {}

  async write(snapshot: FixtureSnapshot): Promise<{ latestPath: string; runPath: string }> {
    const latestPath = path.join(this.outputDir, "latest.json");
    const runPath = path.join(
      this.outputDir,
      "runs",
      `fixtures-${snapshot.scrapedAtUtc.replaceAll(":", "").replaceAll(".", "")}.json`,
    );

    const payload = JSON.stringify(snapshot, null, 2);

    await mkdir(path.dirname(latestPath), { recursive: true });
    await mkdir(path.dirname(runPath), { recursive: true });
    await writeFile(latestPath, payload, "utf8");
    await writeFile(runPath, payload, "utf8");

    return { latestPath, runPath };
  }
}
