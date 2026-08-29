import { assert, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P13-001 metadata declares first-class keyboard/gamepad Jungle Quest",
    run: () => {
      assert(
        JUNGLE_QUEST_METADATA.id === "jungle-quest" && JUNGLE_QUEST_METADATA.title === "Jungle Quest",
        "metadata identity must be stable",
      );
      assert(
        JUNGLE_QUEST_METADATA.players.length === 1 && JUNGLE_QUEST_METADATA.players[0] === 1,
        "game is single player",
      );
      assert(
        JUNGLE_QUEST_METADATA.supportedInputs.includes("keyboard") &&
          JUNGLE_QUEST_METADATA.supportedInputs.includes("gamepad"),
        "keyboard and gamepad must be supported",
      );
      assert(
        JUNGLE_QUEST_METADATA.controls.some((control) => control.action === "action-2"),
        "vine grip must be documented",
      );
      assert(
        JUNGLE_QUEST_METADATA.assetManifest === "assets.json",
        "game must expose its asset manifest",
      );
    },
  },
];
