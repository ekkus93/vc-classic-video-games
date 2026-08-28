import { assert, type TestCase } from "../../test/harness.js";
import { BARREL_CLIMBER_METADATA } from "./metadata.js";
import { BARREL_CLIMBER_MODULE } from "./module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P16-001 Barrel Climber metadata exposes controller-first clean-room launch data",
    run: () => {
      assert(BARREL_CLIMBER_METADATA.id === "barrel-climber", "metadata must use the canonical game ID");
      assert(BARREL_CLIMBER_METADATA.players.length === 1 && BARREL_CLIMBER_METADATA.players[0] === 1, "Barrel Climber must advertise single-player support");
      assert(BARREL_CLIMBER_METADATA.supportedInputs.includes("keyboard") && BARREL_CLIMBER_METADATA.supportedInputs.includes("gamepad"), "keyboard and standard gamepad must both be advertised");
      assert(BARREL_CLIMBER_METADATA.controls.some((control) => control.action === "action-1"), "metadata must describe jump input");
      assert(BARREL_CLIMBER_METADATA.assetManifest === "assets.json", "module must declare its local asset manifest");
    },
  },
  {
    name: "P16 asset resolver stays game-local and rejects unknown paths",
    run: () => {
      assert(BARREL_CLIMBER_MODULE.resolveAssetUrl?.("assets.json")?.includes("assets.json") === true, "module must resolve its manifest");
      assert(BARREL_CLIMBER_MODULE.resolveAssetUrl?.("audio/goal.wav")?.includes("goal.wav") === true, "module must resolve bundled audio");
      assert(BARREL_CLIMBER_MODULE.resolveAssetUrl?.("../space-rocks/assets.json") === null, "resolver must not escape the game asset boundary");
    },
  },
];
