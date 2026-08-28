import { assert, type TestCase } from "../../test/harness.js";
import {
  RIVER_HOPPER_DEFAULT_DIFFICULTY,
  RIVER_HOPPER_DIFFICULTIES,
  RIVER_HOPPER_GOAL_COLUMNS,
  RIVER_HOPPER_RUN_RULES,
  RIVER_HOPPER_STAGES,
  riverHopperGoalCenter,
  riverHopperRoundBonus,
} from "./design.js";
import { RIVER_HOPPER_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P9-001 River Hopper metadata matches the clean-room lane design",
    run: () => {
      assert(RIVER_HOPPER_METADATA.id === "river-hopper", "game ID must be stable");
      assert(RIVER_HOPPER_METADATA.title === "River Hopper", "working title must be canonical");
      assert(
        RIVER_HOPPER_METADATA.description.includes("Juniper") &&
          RIVER_HOPPER_METADATA.description.includes("beacon"),
        "launcher description must use original project vocabulary",
      );
      assert(
        RIVER_HOPPER_METADATA.supportedInputs.join(",") === "keyboard,gamepad",
        "River Hopper must support keyboard and standard gamepad play",
      );
      assert(RIVER_HOPPER_METADATA.assetManifest === "assets.json", "assets stay module-owned");
    },
  },
  {
    name: "P9-001 difficulty pressure is monotonic and has one canonical default",
    run: () => {
      assert(
        RIVER_HOPPER_METADATA.defaultDifficulty === RIVER_HOPPER_DEFAULT_DIFFICULTY,
        "metadata and design must share the default difficulty",
      );
      assert(
        RIVER_HOPPER_DIFFICULTIES.brook.laneSpeedScale <
          RIVER_HOPPER_DIFFICULTIES.channel.laneSpeedScale &&
          RIVER_HOPPER_DIFFICULTIES.channel.laneSpeedScale <
            RIVER_HOPPER_DIFFICULTIES.torrent.laneSpeedScale,
        "harder profiles must increase lane speed",
      );
      assert(
        RIVER_HOPPER_DIFFICULTIES.brook.timeSeconds >
          RIVER_HOPPER_DIFFICULTIES.channel.timeSeconds &&
          RIVER_HOPPER_DIFFICULTIES.channel.timeSeconds >
            RIVER_HOPPER_DIFFICULTIES.torrent.timeSeconds,
        "harder profiles must reduce crossing time",
      );
    },
  },
  {
    name: "P9-001 three original stage layouts provide road and river lane variety",
    run: () => {
      assert(RIVER_HOPPER_STAGES.length === 3, "P9 must ship multiple original stage patterns");
      assert(
        new Set(RIVER_HOPPER_STAGES.map((stage) => stage.id)).size === RIVER_HOPPER_STAGES.length,
        "stage IDs must be unique",
      );
      for (const stage of RIVER_HOPPER_STAGES) {
        assert(
          stage.lanes.filter((lane) => lane.kind === "river").length === 4,
          `${stage.id} must define four river lanes`,
        );
        assert(
          stage.lanes.filter((lane) => lane.kind === "road").length === 5,
          `${stage.id} must define five road lanes`,
        );
      }
      assert(
        new Set(RIVER_HOPPER_STAGES.flatMap((stage) => stage.lanes.map((lane) => `${lane.speed}:${lane.entityWidth}:${lane.spacing}`))).size > 12,
        "layouts must vary more than direction/phase alone",
      );
    },
  },
  {
    name: "P9-007 five goal beacons occupy deterministic in-bounds positions",
    run: () => {
      assert(RIVER_HOPPER_GOAL_COLUMNS.length === 5, "a round must contain five persistent goals");
      for (let index = 0; index < RIVER_HOPPER_GOAL_COLUMNS.length; index += 1) {
        const center = riverHopperGoalCenter(index);
        assert(center > 0 && center < RIVER_HOPPER_RUN_RULES.logicalWidth, "goal centers must be in bounds");
      }
      assert(riverHopperRoundBonus(1) === 900, "round one uses the original base bonus");
      assert(riverHopperRoundBonus(3) === 1250, "round bonuses progress deterministically");
    },
  },
  {
    name: "P9-001 user-facing metadata excludes commercial reference branding",
    run: () => {
      const userFacing = JSON.stringify(RIVER_HOPPER_METADATA).toLowerCase();
      for (const prohibited of ["frogger", "konami"]) {
        assert(!userFacing.includes(prohibited), `metadata must exclude ${prohibited}`);
      }
    },
  },
];
