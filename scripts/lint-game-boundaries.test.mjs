import { resolve } from "node:path";

import { findCrossGameImport } from "./lib/game-import-boundary.mjs";

const root = resolve("/virtual/repository");
const gameSource = resolve(root, "src/games/alpha/entities/player.ts");
const registrySource = resolve(root, "src/games/registry.ts");

const cases = [
  {
    name: "cross-game relative import is rejected",
    source: gameSource,
    specifier: "../../../games/beta/internal.js",
    expectedViolation: true,
  },
  {
    name: "same-game relative import is allowed",
    source: gameSource,
    specifier: "../rules.js",
    expectedViolation: false,
  },
  {
    name: "shared engine relative import is allowed",
    source: gameSource,
    specifier: "../../../engine/game/contracts.js",
    expectedViolation: false,
  },
  {
    name: "games-root registry may compose a game module",
    source: registrySource,
    specifier: "./space-rocks/module.js",
    expectedViolation: false,
  },
];

for (const testCase of cases) {
  const violation = findCrossGameImport(root, testCase.source, testCase.specifier);
  if ((violation !== null) !== testCase.expectedViolation) {
    throw new Error(`Boundary self-test failed: ${testCase.name}`);
  }
}
