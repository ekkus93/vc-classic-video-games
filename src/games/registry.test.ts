import { assert, type TestCase } from "../test/harness.js";
import { createGameRegistry, GAME_MODULES } from "./registry.js";

export const tests: readonly TestCase[] = [
  {
    name: "P9 canonical game registry composes River Hopper as a first-class playable peer",
    run: () => {
      const registry = createGameRegistry();
      assert(
        registry.size === GAME_MODULES.length && GAME_MODULES.length >= 2,
        "canonical composition must register every completed game module",
      );
      assert(registry.has("river-hopper"), "River Hopper must be launcher-registered");
      assert(registry.has("space-rocks"), "Space Rocks reference game must remain registered");
      assert(
        registry.getModule("river-hopper").resolveAssetUrl !== undefined,
        "River Hopper asset resolver must survive registry validation",
      );
      assert(
        registry.getModule("space-rocks").resolveAssetUrl !== undefined,
        "shared resolver fix must preserve Space Rocks production assets too",
      );
    },
  },
  {
    name: "P10-011 canonical registry exposes Maze Chase as a first-class module",
    run: () => {
      const registry = createGameRegistry();
      assert(registry.has("space-rocks"), "reference game must remain registered");
      assert(
        registry.has("maze-chase"),
        "Maze Chase must be discoverable without launcher ID branching",
      );
      assert(
        registry.getModule("maze-chase").resolveAssetUrl?.("assets.json") !== null,
        "canonical registry must preserve Maze Chase bundled asset resolution",
      );
    },
  },
  {
    name: "P11 canonical game registry composes Bug Barrage as a first-class playable peer",
    run: () => {
      const registry = createGameRegistry();
      assert(
        registry.size === GAME_MODULES.length,
        "canonical composition must register every completed game module",
      );
      assert(registry.has("bug-barrage"), "Bug Barrage must be launcher-registered");
      assert(registry.has("space-rocks"), "Space Rocks reference game must remain registered");
      assert(
        registry.getModule("bug-barrage").resolveAssetUrl !== undefined,
        "Bug Barrage asset resolver must survive registry validation",
      );
    },
  },
];
