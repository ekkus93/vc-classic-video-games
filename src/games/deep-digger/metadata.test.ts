import { assert, type TestCase } from "../../test/harness.js";
import {
  DEEP_DIGGER_DEFAULT_DIFFICULTY,
  DEEP_DIGGER_DIFFICULTIES,
  DEEP_DIGGER_RUN_RULES,
  deepDiggerWaveClearScore,
} from "./design.js";
import { DEEP_DIGGER_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P14-001 Deep Digger metadata is registry-ready and controller-first",
    run: () => {
      assert(DEEP_DIGGER_METADATA.id === "deep-digger", "game ID must remain stable");
      assert(DEEP_DIGGER_METADATA.title === "Deep Digger", "working title must be canonical");
      assert(
        DEEP_DIGGER_METADATA.logicalWidth === DEEP_DIGGER_RUN_RULES.logicalWidth &&
          DEEP_DIGGER_METADATA.logicalHeight === DEEP_DIGGER_RUN_RULES.logicalHeight,
        "metadata must use the shared logical framebuffer contract",
      );
      assert(
        DEEP_DIGGER_METADATA.players.join(",") === "1",
        "Deep Digger must declare one-player support",
      );
      assert(
        DEEP_DIGGER_METADATA.supportedInputs.join(",") === "keyboard,gamepad",
        "Deep Digger must not require a pointer device",
      );
      assert(
        DEEP_DIGGER_METADATA.assetManifest === "assets.json",
        "assets must remain owned by the Deep Digger module",
      );
    },
  },
  {
    name: "P14 difficulty and score progression are canonical and monotonic",
    run: () => {
      assert(
        DEEP_DIGGER_METADATA.defaultDifficulty === DEEP_DIGGER_DEFAULT_DIFFICULTY,
        "default difficulty must come from one design table",
      );
      assert(
        Object.keys(DEEP_DIGGER_DIFFICULTIES).join(",") === "survey,bore,mantle",
        "difficulty IDs must retain original P14 naming",
      );
      assert(
        DEEP_DIGGER_DIFFICULTIES.survey.enemyMoveIntervalSeconds >
          DEEP_DIGGER_DIFFICULTIES.bore.enemyMoveIntervalSeconds &&
          DEEP_DIGGER_DIFFICULTIES.bore.enemyMoveIntervalSeconds >
            DEEP_DIGGER_DIFFICULTIES.mantle.enemyMoveIntervalSeconds,
        "harder profiles must move enemies more frequently",
      );
      assert(deepDiggerWaveClearScore(1) === 400, "wave one must use the base bonus");
      assert(deepDiggerWaveClearScore(4) === 700, "wave bonuses must advance deterministically");
    },
  },
  {
    name: "P14 user-facing metadata avoids commercial reference branding",
    run: () => {
      const userFacing = JSON.stringify(DEEP_DIGGER_METADATA).toLowerCase();
      for (const prohibited of ["dig dug", "namco"]) {
        assert(
          !userFacing.includes(prohibited),
          `user-facing metadata must not contain commercial reference term ${prohibited}`,
        );
      }
    },
  },
];
