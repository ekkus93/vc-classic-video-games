import { assert, type TestCase } from "../test/harness.js";
import { createGameRegistry } from "./registry.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-011 canonical registry exposes Maze Chase as a first-class module",
    run: () => {
      const registry = createGameRegistry();
      assert(registry.has("space-rocks"), "reference game must remain registered");
      assert(registry.has("maze-chase"), "Maze Chase must be discoverable without launcher ID branching");
      assert(
        registry.getModule("maze-chase").resolveAssetUrl?.("assets.json") !== null,
        "canonical registry must preserve Maze Chase bundled asset resolution",
      );
    },
  },
];
