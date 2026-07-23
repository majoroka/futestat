import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const branch = process.env.FUTESTAT_PUBLISH_BRANCH ?? "fixtures-data";
const sourceDir = path.join(repoRoot, "data", "fixtures");
const latestPath = path.join(sourceDir, "latest.json");
const worktreeDir = await mkdtemp(path.join(tmpdir(), "futestat-fixtures-publish-"));
const dryRun = process.argv.includes("--dry-run");

await ensureSourceSnapshot(latestPath);

try {
  const branchExists = remoteBranchExists(branch);

  if (branchExists) {
    git(["fetch", "origin", branch]);
    git(["worktree", "add", "--detach", worktreeDir, `origin/${branch}`]);
  } else {
    git(["worktree", "add", "--detach", worktreeDir, "HEAD"]);
    git(["switch", "--orphan", branch], { cwd: worktreeDir });
    await clearWorktree(worktreeDir);
  }

  await writeFile(
    path.join(worktreeDir, "README.md"),
    "# Futestat Fixtures Store\n\nEste ramo guarda apenas a store canónica de fixtures gerada localmente.\n",
    "utf8",
  );
  await rm(path.join(worktreeDir, "data", "fixtures"), { recursive: true, force: true });
  await cp(sourceDir, path.join(worktreeDir, "data", "fixtures"), { recursive: true });

  ensureCommitIdentity(worktreeDir);
  git(["add", "README.md", "data/fixtures"], { cwd: worktreeDir });

  if (!hasStagedChanges(worktreeDir)) {
    console.log(`No fixture changes to publish to ${branch}.`);
    process.exit(0);
  }

  if (dryRun) {
    console.log(`Dry run complete. Fixture changes are ready to publish to ${branch}.`);
    process.exit(0);
  }

  git(["commit", "-m", "Refresh fixtures window"], { cwd: worktreeDir });
  git(["push", "origin", `HEAD:${branch}`], { cwd: worktreeDir });
  console.log(`Published fixtures snapshot to ${branch}.`);
} finally {
  try {
    git(["worktree", "remove", "--force", worktreeDir]);
  } catch {}

  await rm(worktreeDir, { recursive: true, force: true });
}

async function ensureSourceSnapshot(filePath) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(
      `Missing local snapshot at ${filePath}. Run "npm run scrape:fixtures" first.`,
    );
  }
}

async function clearWorktree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    await rm(path.join(directory, entry.name), { recursive: true, force: true });
  }
}

function ensureCommitIdentity(cwd) {
  const name = gitOptional(["config", "--get", "user.name"], { cwd }) || "Futestat Local Publisher";
  const email =
    gitOptional(["config", "--get", "user.email"], { cwd }) || "fixtures@local.futestat";

  git(["config", "user.name", name], { cwd });
  git(["config", "user.email", email], { cwd });
}

function hasStagedChanges(cwd) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet", "--", "README.md", "data/fixtures"], {
    cwd,
    encoding: "utf8",
  });

  return result.status === 1;
}

function remoteBranchExists(name) {
  const result = spawnSync("git", ["ls-remote", "--exit-code", "--heads", "origin", name], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return result.status === 0;
}

function gitOptional(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}
