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

// CR-018: an entry that never classifies itself must fail, not be waved through as original.
let undeclaredAttributionFailed = false;
try {
  validateAttributionDocument({ schemaVersion: 1, assets: [{ path: "x.png" }] });
} catch {
  undeclaredAttributionFailed = true;
}
assert(
  undeclaredAttributionFailed,
  "attribution entry omitting original entirely must fail",
);

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

  // CR-018: a manifest entry that omits `original` used to skip the attribution check entirely,
  // so an unlicensed third-party file shipped simply by not saying what it was. The file below
  // exists and has no attribution record, so the only thing that can reject it is the new rule.
  const present = join(root, "game", "present.png");
  await writeFile(present, "not-a-real-png");
  const undeclared = join(root, "game", "undeclared.json");
  await writeFile(
    undeclared,
    JSON.stringify({
      version: 1,
      assets: [{ id: "undeclared", path: "present.png", type: "image" }],
    }),
  );
  let undeclaredFailed = false;
  try {
    await validateManifestFile(undeclared, new Set());
  } catch {
    undeclaredFailed = true;
  }
  assert(undeclaredFailed, "manifest asset omitting original entirely must fail");

  // The same entry passes once it classifies itself, so the rule rejects silence, not the asset.
  const declared = join(root, "game", "declared.json");
  await writeFile(
    declared,
    JSON.stringify({
      version: 1,
      assets: [{ id: "declared", path: "present.png", type: "image", original: true }],
    }),
  );
  await validateManifestFile(declared, new Set());
} finally {
  await rm(root, { recursive: true, force: true });
}
