import { assert, type TestCase } from "../../test/harness.js";
import { defineGameMetadata } from "./metadata.js";
import { GameRegistry } from "./registry.js";
import type { GameModule } from "./contracts.js";

const MODULE: GameModule = {
  metadata: defineGameMetadata({
    id: "asset-resolver-test",
    title: "Asset Resolver Test",
    description: "Registry resolver preservation fixture",
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
    name: "P9 shared registry preserves optional bundled asset resolver after metadata validation",
    run: () => {
      const registered = new GameRegistry([MODULE]).getModule(MODULE.metadata.id);
      assert(registered.resolveAssetUrl !== undefined, "validated registry module must retain its asset resolver");
      assert(registered.resolveAssetUrl?.("assets.json") === "bundle://assets.json", "preserved resolver must retain module behavior");
    },
  },
];
