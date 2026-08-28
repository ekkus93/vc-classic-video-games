import { resolve } from "node:path";

import { findCrossGameImport } from "./lib/game-import-boundary.mjs";

const root = resolve("/virtual/repository");
const source = resolve(root, "src/games/alpha/entities/player.ts");

const cases = [
  {
    name: "cross-game relative import is rejected",
    specifier: "../../../games/beta/internal.js",
    expectedViolation: true,
  },
  {
    name: "same-game relative import is allowed",
    specifier: "../rules.js",
    expectedViolation: false,
  },
  {
    name: "shared engine relative import is allowed",
    specifier: "../../../engine/game/contracts.js",
    expectedViolation: false,
  },
];

for (const testCase of cases) {
  const violation = findCrossGameImport(root, source, testCase.specifier);
  if ((violation !== null) !== testCase.expectedViolation) {
    throw new Error(`Boundary self-test failed: ${testCase.name}`);
  }
}
