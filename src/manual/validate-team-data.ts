import { validateTeamDataArtifacts } from "../infrastructure/manual/team-data-validator.js";

async function main(): Promise<void> {
  const summary = await validateTeamDataArtifacts(process.cwd());
  console.log(JSON.stringify(summary, null, 2));

  if (summary.issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
