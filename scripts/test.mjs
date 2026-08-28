import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const outputRoot = resolve(".test-dist");
await rm(outputRoot, { recursive: true, force: true });

const command =
  process.platform === "win32"
    ? "node_modules\\.bin\\tsc.cmd"
    : "node_modules/.bin/tsc";
const compile = spawnSync(command, ["-p", "tsconfig.test.json"], {
  stdio: "inherit",
});

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTests(path)));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(path);
    }
  }

  return files.sort();
}

let failures = 0;
let count = 0;

try {
  const testFiles = await collectTests(outputRoot);

  if (testFiles.length === 0) {
    throw new Error("No compiled TypeScript tests were found");
  }

  for (const file of testFiles) {
    const module = await import(pathToFileURL(file).href);
    if (!Array.isArray(module.tests)) {
      throw new Error(`${file} must export a tests array`);
    }

    for (const test of module.tests) {
      count += 1;
      try {
        await test.run();
        console.log(`ok ${count} - ${test.name}`);
      } catch (error) {
        failures += 1;
        console.error(`not ok ${count} - ${test.name}`);
        console.error(error);
      }
    }
  }

  console.log(`1..${count}`);
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

if (failures > 0) {
  process.exit(1);
}
