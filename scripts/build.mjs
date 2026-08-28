import { spawnSync } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

const command =
  process.platform === "win32"
    ? "node_modules\\.bin\\tsc.cmd"
    : "node_modules/.bin/tsc";
const result = spawnSync(command, ["-p", "tsconfig.build.json"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await copyFile("index.html", "dist/index.html");
