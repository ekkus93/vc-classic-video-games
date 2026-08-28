import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import {
  extractModuleSpecifiers,
  findCrossGameImport,
} from "./lib/game-import-boundary.mjs";

const root = process.cwd();
const excludedDirectories = new Set([
  ".git",
  ".test-dist",
  "dist",
  "node_modules",
  "target",
]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

const rules = [
  { pattern: /\bdebugger\s*;/u, message: "debugger statements are forbidden" },
  { pattern: /\beval\s*\(/u, message: "dynamic evaluation is forbidden" },
  {
    pattern: /\bnew\s+Function\s*\(/u,
    message: "dynamic Function construction is forbidden",
  },
  {
    pattern: /@ts-(?:ignore|nocheck)\b/u,
    message: "TypeScript error suppression is forbidden",
  },
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(path)));
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files.sort();
}

let failures = 0;

for (const path of await collect(root)) {
  const source = await readFile(path, "utf8");
  const lines = source.split("\n");

  for (const rule of rules) {
    const match = rule.pattern.exec(source);
    if (match === null) {
      continue;
    }

    failures += 1;
    const line = source.slice(0, match.index).split("\n").length;
    console.error(`${relative(root, path)}:${line}: ${rule.message}`);
  }

  if (
    path.includes(`${join("src", "games")}`) &&
    lines.some((line) => /Math\.random\s*\(/u.test(line))
  ) {
    failures += 1;
    console.error(
      `${relative(root, path)}: game code must use the shared seeded RNG service`,
    );
  }

  for (const specifier of extractModuleSpecifiers(source)) {
    const violation = findCrossGameImport(root, path, specifier);
    if (violation === null) {
      continue;
    }

    failures += 1;
    console.error(
      `${relative(root, path)}: game ${violation.sourceGame} must not import internals from game ${violation.targetGame} (${specifier})`,
    );
  }
}

if (failures > 0) {
  process.exit(1);
}
