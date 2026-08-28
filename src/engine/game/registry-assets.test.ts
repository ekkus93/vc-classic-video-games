import { assert, type TestCase } from "../../test/harness.js";
import { GameRegistry } from "./registry.js";
import type { GameModule } from "./contracts.js";

const MODULE_WITH_ASSETS: GameModule = Object.freeze({
  metadata: Object.freeze({
    id: "asset-game",
    title: "Asset Game",
    description: "Registry asset resolver regression fixture.",
    version: 1,
    players: [1],
    supportedInputs: ["keyboard"] as const,
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "normal",
    difficulties: [Object.freeze({ id: "normal", label: "Normal" })],
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
  resolveAssetUrl: (path: string) => (path === "assets.json" ? "fixture://assets.json" : null),
});

export const tests: readonly TestCase[] = [
  {
    name: "P11 shared registry validation preserves optional module asset resolvers",
    run: () => {
      const module = new GameRegistry([MODULE_WITH_ASSETS]).getModule("asset-game");
      assert(module.resolveAssetUrl !== undefined, "registered module must retain its resolver");
      assert(
        module.resolveAssetUrl("assets.json") === "fixture://assets.json",
        "registered resolver must preserve original behavior",
      );
    },
  },
];
