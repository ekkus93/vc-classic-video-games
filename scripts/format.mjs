import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") {
  throw new Error("Usage: node scripts/format.mjs --check|--write");
}

const root = process.cwd();
const excludedDirectories = new Set([
  ".git",
  ".test-dist",
  "dist",
  "node_modules",
  "target",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const textNames = new Set([
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  "Cargo.lock",
]);

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
      continue;
    }

    if (
      entry.isFile() &&
      (textExtensions.has(extname(entry.name)) || textNames.has(entry.name))
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

function normalizeText(path, source) {
  let normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  if (extname(path) === ".json") {
    normalized = `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
  } else {
    normalized = normalized
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/u, ""))
      .join("\n")
      .replace(/\n*$/u, "\n");
  }

  return normalized;
}

const mismatches = [];

for (const path of await collect(root)) {
  const source = await readFile(path, "utf8");
  const normalized = normalizeText(path, source);

  if (source === normalized) {
    continue;
  }

  if (mode === "--write") {
    await writeFile(path, normalized, "utf8");
  } else {
    mismatches.push(relative(root, path));
  }
}

if (mismatches.length > 0) {
  console.error("Formatting differences found:");
  for (const path of mismatches) {
    console.error(`  ${path}`);
  }
  process.exit(1);
}
