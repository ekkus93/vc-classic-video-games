import { assert, type TestCase } from "../../test/harness.js";
import {
  BUG_BARRAGE_DEFAULT_DIFFICULTY,
  BUG_BARRAGE_DIFFICULTIES,
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
} from "./design.js";
import { BUG_BARRAGE_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11-001 Bug Barrage metadata encodes the clean-room production contract",
    run: () => {
      assert(BUG_BARRAGE_METADATA.id === "bug-barrage", "game ID must be stable");
      assert(BUG_BARRAGE_METADATA.title === "Bug Barrage", "title must be canonical");
      assert(
        BUG_BARRAGE_METADATA.logicalWidth === BUG_BARRAGE_RUN_RULES.logicalWidth &&
          BUG_BARRAGE_METADATA.logicalHeight === BUG_BARRAGE_RUN_RULES.logicalHeight,
        "metadata must use the canonical logical framebuffer",
      );
      assert(
        BUG_BARRAGE_METADATA.defaultDifficulty === BUG_BARRAGE_DEFAULT_DIFFICULTY,
        "default difficulty must come from the design contract",
      );
      assert(
        BUG_BARRAGE_METADATA.difficulties.length ===
          Object.keys(BUG_BARRAGE_DIFFICULTIES).length,
        "all designed difficulty profiles must be exposed",
      );
      assert(
        BUG_BARRAGE_METADATA.supportedInputs.includes("keyboard") &&
          BUG_BARRAGE_METADATA.supportedInputs.includes("gamepad") &&
          !BUG_BARRAGE_METADATA.supportedInputs.includes("pointer"),
        "Bug Barrage must use shared keyboard/gamepad logical input",
      );
      assert(
        BUG_BARRAGE_METADATA.controls.some((control) => control.action === "action-1"),
        "spark fire must be documented",
      );
      assert(
        BUG_BARRAGE_LIMITS.maxSegments <= 40 && BUG_BARRAGE_LIMITS.maxRoamers <= 6,
        "core enemy populations must retain explicit hard caps",
      );
    },
  },
];
