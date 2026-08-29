import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAttributionDocument(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.assets)) {
    throw new Error("assets/ATTRIBUTION.json must contain schemaVersion 1 and an assets array");
  }
  const seen = new Set();
  for (const [index, asset] of value.assets.entries()) {
    if (!isObject(asset) || typeof asset.path !== "string" || asset.path.length === 0) {
      throw new Error(`attribution assets[${index}].path is required`);
    }
    if (seen.has(asset.path)) {
      throw new Error(`duplicate attribution path: ${asset.path}`);
    }
    seen.add(asset.path);
    // CR-018: fail closed. An entry that never says whether it is original is not a third-party
    // asset that happens to be missing its paperwork -- it is an asset nobody has classified, and
    // treating silence as "original" is exactly how an unlicensed file ships.
    if (typeof asset.original !== "boolean") {
      throw new Error(
        `attribution assets[${index}] (${asset.path}) must declare original as a boolean`,
      );
    }
    if (asset.original === true) {
      continue;
    }
    for (const field of ["source", "license", "copyright"]) {
      if (typeof asset[field] !== "string" || asset[field].trim().length === 0) {
        throw new Error(`non-original asset ${asset.path} requires ${field}`);
      }
    }
  }
  return seen;
}

export async function validateManifestFile(path, attributionPaths) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!isObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.assets)) {
    throw new Error(`${path}: invalid manifest root`);
  }
  const seen = new Set();
  for (const [index, asset] of parsed.assets.entries()) {
    if (!isObject(asset) || typeof asset.id !== "string" || typeof asset.path !== "string" || typeof asset.type !== "string") {
      throw new Error(`${path}: assets[${index}] is malformed`);
    }
    if (seen.has(asset.id)) {
      throw new Error(`${path}: duplicate asset id ${asset.id}`);
    }
    seen.add(asset.id);
    const file = resolve(dirname(path), asset.path);
    try {
      await access(file);
    } catch {
      throw new Error(`${path}: asset ${asset.id} references missing file ${asset.path}`);
    }
    // CR-018: same fail-closed rule as the attribution document -- a manifest entry must say
    // which it is, and anything not explicitly original needs a matching attribution record.
    if (typeof asset.original !== "boolean") {
      throw new Error(`${path}: asset ${asset.id} must declare original as a boolean`);
    }
    const repoRelative = relative(process.cwd(), file).replaceAll("\\", "/");
    if (asset.original !== true && !attributionPaths.has(repoRelative)) {
      throw new Error(`${path}: non-original asset ${repoRelative} lacks attribution`);
    }
  }
}

async function collectManifests(directory) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectManifests(path)));
    } else if (entry.isFile() && entry.name === "assets.json") {
      result.push(path);
    }
  }
  return result;
}

export async function validateRepository(root = process.cwd()) {
  const attribution = JSON.parse(
    await readFile(join(root, "assets", "ATTRIBUTION.json"), "utf8"),
  );
  const attributionPaths = validateAttributionDocument(attribution);
  for (const manifest of await collectManifests(join(root, "src", "games"))) {
    await validateManifestFile(manifest, attributionPaths);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await validateRepository();
}
