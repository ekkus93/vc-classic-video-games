import { assert, type TestCase } from "../../test/harness.js";
import { GAME_MODULES, createGameRegistry } from "../registry.js";

export const tests: readonly TestCase[] = [
  {
    name: "P14 canonical games-root composition registers Deep Digger without launcher branching",
    run: () => {
      assert(
        GAME_MODULES.some((module) => module.metadata.id === "deep-digger"),
        "canonical module list must include Deep Digger",
      );
      const registry = createGameRegistry();
      assert(
        registry.getModule("deep-digger").metadata.title === "Deep Digger",
        "canonical registry must resolve Deep Digger metadata and module",
      );
      assert(
        typeof registry.getModule("deep-digger").resolveAssetUrl === "function",
        "registry must preserve the module asset resolver used by production preload",
      );
    },
  },
];
