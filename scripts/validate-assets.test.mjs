import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateAttributionDocument,
  validateManifestFile,
} from "./validate-assets.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

validateAttributionDocument({ schemaVersion: 1, assets: [] });
let attributionFailed = false;
try {
  validateAttributionDocument({
    schemaVersion: 1,
    assets: [{ path: "x.png", original: false }],
  });
} catch {
  attributionFailed = true;
}
assert(attributionFailed, "unattributed third-party asset fixture must fail");

const root = await mkdtemp(join(tmpdir(), "vc-assets-"));
try {
  await mkdir(join(root, "game"), { recursive: true });
  const manifest = join(root, "game", "assets.json");
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      assets: [{ id: "missing", path: "missing.png", type: "image" }],
    }),
  );
  let missingFailed = false;
  try {
    await validateManifestFile(manifest, new Set());
  } catch {
    missingFailed = true;
  }
  assert(missingFailed, "missing manifest asset fixture must fail");
} finally {
  await rm(root, { recursive: true, force: true });
}
