import { spawnSync } from "node:child_process";

run(["npm", "run", "scrape:fixtures"]);
run(["npm", "run", "publish:fixtures-data"]);

function run(command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
