import { assert, type TestCase } from "../../test/harness.js";
import {
  SPACE_ROCKS_DEFAULT_DIFFICULTY,
  SPACE_ROCKS_DIFFICULTIES,
  SPACE_ROCKS_RUN_RULES,
  SPACE_ROCKS_SCORING,
  spaceRocksWaveClearScore,
} from "./design.js";
import { SPACE_ROCKS_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P7-001 Space Rocks metadata matches the clean-room design contract",
    run: () => {
      assert(SPACE_ROCKS_METADATA.id === "space-rocks", "game ID must be stable");
      assert(SPACE_ROCKS_METADATA.title === "Space Rocks", "working title must be canonical");
      assert(
        SPACE_ROCKS_METADATA.description.includes("Kestrel") &&
          SPACE_ROCKS_METADATA.description.includes("fracture rocks"),
        "launcher description must use the original craft and hazard vocabulary",
      );
      assert(
        SPACE_ROCKS_METADATA.logicalWidth === SPACE_ROCKS_RUN_RULES.logicalWidth &&
          SPACE_ROCKS_METADATA.logicalHeight === SPACE_ROCKS_RUN_RULES.logicalHeight,
        "metadata must use the canonical logical framebuffer",
      );
      assert(
        SPACE_ROCKS_METADATA.players.join(",") === "1",
        "P7 reference game must declare single-player support",
      );
      assert(
        SPACE_ROCKS_METADATA.supportedInputs.join(",") === "keyboard,gamepad",
        "Space Rocks must be controller-first without requiring pointer input",
      );
      assert(
        SPACE_ROCKS_METADATA.assetManifest === "assets.json",
        "game assets must remain owned by the Space Rocks module",
      );
    },
  },
  {
    name: "P7-001 difficulty metadata is generated from one canonical design table",
    run: () => {
      assert(
        SPACE_ROCKS_METADATA.defaultDifficulty === SPACE_ROCKS_DEFAULT_DIFFICULTY,
        "metadata default difficulty must match gameplay design",
      );
      assert(
        SPACE_ROCKS_METADATA.difficulties.map((entry) => entry.id).join(",") ===
          Object.keys(SPACE_ROCKS_DIFFICULTIES).join(","),
        "metadata difficulty IDs must match the canonical profiles",
      );
      assert(
        SPACE_ROCKS_METADATA.difficulties.map((entry) => entry.label).join(",") ===
          "Drift,Orbit,Nova",
        "difficulty labels must retain the original Space Rocks naming",
      );
      assert(
        SPACE_ROCKS_DIFFICULTIES.drift.initialLargeRocks <
          SPACE_ROCKS_DIFFICULTIES.orbit.initialLargeRocks &&
          SPACE_ROCKS_DIFFICULTIES.orbit.initialLargeRocks <
            SPACE_ROCKS_DIFFICULTIES.nova.initialLargeRocks,
        "difficulty pressure must increase monotonically",
      );
      assert(
        SPACE_ROCKS_DIFFICULTIES.drift.rockSpeedScale <
          SPACE_ROCKS_DIFFICULTIES.orbit.rockSpeedScale &&
          SPACE_ROCKS_DIFFICULTIES.orbit.rockSpeedScale <
            SPACE_ROCKS_DIFFICULTIES.nova.rockSpeedScale,
        "rock speed pressure must increase monotonically",
      );
      assert(
        SPACE_ROCKS_DIFFICULTIES.drift.spawnProtectionSeconds >
          SPACE_ROCKS_DIFFICULTIES.orbit.spawnProtectionSeconds &&
          SPACE_ROCKS_DIFFICULTIES.orbit.spawnProtectionSeconds >
            SPACE_ROCKS_DIFFICULTIES.nova.spawnProtectionSeconds,
        "harder profiles must not receive more spawn protection",
      );
    },
  },
  {
    name: "P7-001 controls use shared logical actions and define the intended run inputs",
    run: () => {
      assert(
        SPACE_ROCKS_METADATA.controls.map((control) => control.action).join(",") ===
          "left,right,up,action-1,pause",
        "controls must be rotation thrust pulse fire and shared pause",
      );
    },
  },
  {
    name: "P7-001 scoring is project-owned and wave bonus progression is deterministic",
    run: () => {
      assert(
        [
          SPACE_ROCKS_SCORING.largeRock,
          SPACE_ROCKS_SCORING.mediumRock,
          SPACE_ROCKS_SCORING.smallRock,
        ].join(",") === "35,90,225",
        "fracture-rock scores must retain the approved project-owned values",
      );
      assert(spaceRocksWaveClearScore(1) === 300, "wave one bonus must use the base value");
      assert(spaceRocksWaveClearScore(4) === 480, "wave bonus must advance by a deterministic step");

      let rejected = false;
      try {
        spaceRocksWaveClearScore(0);
      } catch (error) {
        rejected = error instanceof RangeError;
      }
      assert(rejected, "invalid wave numbers must fail closed");
    },
  },
  {
    name: "P7-001 user-facing metadata does not expose commercial reference branding",
    run: () => {
      const userFacing = JSON.stringify(SPACE_ROCKS_METADATA).toLowerCase();
      for (const prohibited of ["asteroids", "atari"]) {
        assert(
          !userFacing.includes(prohibited),
          `user-facing metadata must not contain commercial reference term ${prohibited}`,
        );
      }
    },
  },
];
