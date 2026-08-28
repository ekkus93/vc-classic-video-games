import type { GameModule } from "./contracts.js";
import { GameRegistry } from "./registry.js";
import { assert, type TestCase } from "../../test/harness.js";

const MODULE_WITH_ASSET_RESOLVER: GameModule = Object.freeze({
  metadata: Object.freeze({
    id: "resolver-fixture",
    title: "Resolver Fixture",
    description: "Registry asset-resolver preservation fixture.",
    version: 1,
    players: Object.freeze([1]),
    supportedInputs: Object.freeze(["keyboard"] as const),
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "default",
    difficulties: Object.freeze([
      Object.freeze({ id: "default", label: "Default" }),
    ]),
    controls: Object.freeze([]),
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
  resolveAssetUrl: (path: string) => `fixture://${path}`,
});

export const tests: readonly TestCase[] = [
  {
    name: "P14 registry validation preserves optional bundled asset resolver",
    run: () => {
      const module = new GameRegistry([MODULE_WITH_ASSET_RESOLVER]).getModule(
        "resolver-fixture",
      );
      assert(
        module.resolveAssetUrl?.("assets.json") === "fixture://assets.json",
        "validated module must retain the resolver required by production asset preload",
      );
    },
  },
];
