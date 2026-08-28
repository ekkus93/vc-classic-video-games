import { assert, type TestCase } from "../../test/harness.js";
import { createGameRegistry } from "../registry.js";

export const tests: readonly TestCase[] = [
  {
    name: "P15 canonical launcher registry exposes Star Defender with owned assets",
    run: () => {
      const registry = createGameRegistry();
      assert(registry.has("star-defender"), "canonical registry must include Star Defender");
      const module = registry.getModule("star-defender");
      assert(
        module.resolveAssetUrl?.(module.metadata.assetManifest)?.includes(
          "star-defender/assets.json",
        ) === true,
        "registered production module must retain its game-owned manifest resolver",
      );
    },
  },
];
