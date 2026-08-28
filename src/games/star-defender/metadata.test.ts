import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_DEFAULT_DIFFICULTY, STAR_DEFENDER_RUN_RULES } from "./design.js";
import { STAR_DEFENDER_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P15-001 Star Defender metadata records the clean-room controller-first contract",
    run: () => {
      assert(STAR_DEFENDER_METADATA.id === "star-defender", "game ID must be stable");
      assert(STAR_DEFENDER_METADATA.title === "Star Defender", "title must be canonical");
      assert(
        STAR_DEFENDER_METADATA.logicalWidth === STAR_DEFENDER_RUN_RULES.logicalWidth &&
          STAR_DEFENDER_METADATA.logicalHeight === STAR_DEFENDER_RUN_RULES.logicalHeight,
        "metadata must expose the implemented logical framebuffer",
      );
      assert(
        STAR_DEFENDER_METADATA.defaultDifficulty === STAR_DEFENDER_DEFAULT_DIFFICULTY,
        "default difficulty must match the design contract",
      );
      assert(
        JSON.stringify(STAR_DEFENDER_METADATA.supportedInputs) ===
          JSON.stringify(["keyboard", "gamepad"]),
        "Star Defender must use shared keyboard and gamepad input without pointer dependency",
      );
      assert(
        STAR_DEFENDER_METADATA.controls.some((control) => control.action === "action-2"),
        "metadata must expose the limited emergency action",
      );
      assert(
        STAR_DEFENDER_METADATA.assetManifest === "assets.json",
        "assets must remain game-module owned",
      );
    },
  },
];
