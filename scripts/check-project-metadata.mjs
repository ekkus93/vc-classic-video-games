import { readFile } from "node:fs/promises";

const expected = Object.freeze({
  packageName: "vc-classic-video-games",
  productName: "VC Classic Video Games",
  identifier: "com.ekkus93.vcclassicvideogames",
});

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const tauriConfig = JSON.parse(
  await readFile("src-tauri/tauri.conf.json", "utf8"),
);
const cargoToml = await readFile("src-tauri/Cargo.toml", "utf8");

function cargoValue(key) {
  const match = cargoToml.match(new RegExp(`^${key} = "([^"]+)"$`, "mu"));
  if (match === null) {
    throw new Error(`Missing ${key} in src-tauri/Cargo.toml`);
  }
  return match[1];
}

const checks = [
  ["package name", packageJson.name, expected.packageName],
  ["Cargo package name", cargoValue("name"), expected.packageName],
  ["Tauri product name", tauriConfig.productName, expected.productName],
  ["Tauri identifier", tauriConfig.identifier, expected.identifier],
  ["Cargo/package version", cargoValue("version"), packageJson.version],
  ["Tauri/package version", tauriConfig.version, packageJson.version],
];

for (const [label, actual, wanted] of checks) {
  if (actual !== wanted) {
    throw new Error(`${label} mismatch: expected ${wanted}, got ${actual}`);
  }
}
