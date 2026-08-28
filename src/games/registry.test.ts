import { assert, type TestCase } from "../test/harness.js";
import { BUG_BARRAGE_MODULE } from "./bug-barrage/module.js";
import { createGameRegistry, GAME_MODULES } from "./registry.js";
import { SPACE_ROCKS_MODULE } from "./space-rocks/module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11 canonical registry adds Bug Barrage without displacing Space Rocks",
    run: () => {
      assert(GAME_MODULES.length === 2, "P11 baseline must expose exactly two completed games");
      assert(GAME_MODULES[0] === SPACE_ROCKS_MODULE, "Space Rocks ordering must remain stable");
      assert(GAME_MODULES[1] === BUG_BARRAGE_MODULE, "Bug Barrage must be appended additively");
      const registry = createGameRegistry();
      assert(registry.has("space-rocks"), "Space Rocks must remain registered");
      assert(registry.has("bug-barrage"), "Bug Barrage must be launchable");
      assert(
        registry.getModule("bug-barrage").resolveAssetUrl?.("assets.json") !== null &&
          registry.getModule("bug-barrage").resolveAssetUrl !== undefined,
        "registry validation must preserve a game module asset resolver",
      );
    },
  },
];
