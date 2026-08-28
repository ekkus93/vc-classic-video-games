import { assert, type TestCase } from "../../test/harness.js";
import type { GameModule } from "./contracts.js";
import { defineGameMetadata } from "./metadata.js";
import { GameRegistry } from "./registry.js";

function assetModule(): GameModule {
  return {
    metadata: defineGameMetadata({
      id: "asset-probe",
      title: "Asset Probe",
      description: "Registry resolver preservation probe.",
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
}

export const tests: readonly TestCase[] = [
  {
    name: "P15 shared registry preserves optional bundled-asset resolver",
    run: () => {
      const registry = new GameRegistry([assetModule()]);
      const registered = registry.getModule("asset-probe");
      assert(
        registered.resolveAssetUrl?.("assets.json") === "bundle://assets.json",
        "registry validation must not strip the module resolver required by BrowserGameServices",
      );
      assert(
        registered.metadata.id === "asset-probe",
        "resolver preservation must retain the validated metadata snapshot",
      );
    },
  },
];
