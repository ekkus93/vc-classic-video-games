import { assert, type TestCase } from "../../test/harness.js";
import { createGameRegistry } from "../registry.js";

export const tests: readonly TestCase[] = [
  {
    name: "P16 launcher composition registers Barrel Climber without game-specific shell branches",
    run: () => {
      const registry = createGameRegistry();
      assert(registry.has("space-rocks"), "reference Space Rocks registration must remain intact");
      assert(registry.has("barrel-climber"), "canonical games root must register Barrel Climber");
      assert(registry.getModule("barrel-climber").metadata.title === "Barrel Climber", "registry must expose Barrel Climber metadata through the normal contract");
    },
  },
];
