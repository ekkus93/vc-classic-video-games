import { assert, type TestCase } from "../../test/harness.js";
import type { GameModule } from "./contracts.js";
import { defineGameMetadata } from "./metadata.js";
import { GameRegistry } from "./registry.js";

// CR-021: merged from the former registry-assets.test.ts, which covered the same behavior under a
// second task ID. Labelled P2-004 (the registry itself, which is what preserves the field);
// the optional resolveAssetUrl hook it preserves arrived with P7-008's bundled audio, and the
// per-game phases the old labels named (P9, P14) were only consumers of it.
const MODULE_WITH_ASSET_RESOLVER: GameModule = {
  metadata: defineGameMetadata({
    id: "resolver-fixture",
    title: "Resolver Fixture",
    description: "Registry asset-resolver preservation fixture.",
    version: 1,
    players: [1],
    supportedInputs: ["keyboard"],
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "normal",
    difficulties: [{ id: "normal", label: "Normal" }],
    controls: [],
    assetManifest: "assets.json",
  }),
  create: () => ({
    start: () => undefined,
    update: () => undefined,
    render: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    reset: () => undefined,
    destroy: () => undefined,
  }),
  resolveAssetUrl: (path) => `bundle://${path}`,
};

export const tests: readonly TestCase[] = [
  {
    name: "P2-004 registry validation preserves a module's optional bundled asset resolver",
    run: () => {
      const registered = new GameRegistry([MODULE_WITH_ASSET_RESOLVER]).getModule(
        MODULE_WITH_ASSET_RESOLVER.metadata.id,
      );
      assert(
        registered.resolveAssetUrl !== undefined,
        "validated registry module must retain its asset resolver, which production asset preload depends on",
      );
      assert(
        registered.resolveAssetUrl?.("assets.json") === "bundle://assets.json",
        "the preserved resolver must still be the module's own, not a stub",
      );
    },
  },
];
