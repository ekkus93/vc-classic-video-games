import { assert, type TestCase } from "../../test/harness.js";
import {
  MAZE_CHASE_DEFAULT_DIFFICULTY,
  MAZE_CHASE_DIFFICULTIES,
  MAZE_CHASE_RUN_RULES,
  MAZE_CHASE_SCORING,
  mazeChaseLevelClearScore,
  mazeChaseLevelSpeedScale,
} from "./design.js";
import { MAZE_CHASE_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-001 Maze Chase metadata matches the clean-room design contract",
    run: () => {
      assert(MAZE_CHASE_METADATA.id === "maze-chase", "game ID must be stable");
      assert(MAZE_CHASE_METADATA.title === "Maze Chase", "working title must be canonical");
      assert(
        MAZE_CHASE_METADATA.description.includes("Circuit Garden") &&
          MAZE_CHASE_METADATA.description.includes("sentinels"),
        "launcher copy must use project-owned maze and enemy vocabulary",
      );
      assert(
        MAZE_CHASE_METADATA.logicalWidth === MAZE_CHASE_RUN_RULES.logicalWidth &&
          MAZE_CHASE_METADATA.logicalHeight === MAZE_CHASE_RUN_RULES.logicalHeight,
        "metadata must use the canonical logical framebuffer",
      );
      assert(
        MAZE_CHASE_METADATA.players.join(",") === "1",
        "Maze Chase must declare single-player support",
      );
      assert(
        MAZE_CHASE_METADATA.supportedInputs.join(",") === "keyboard,gamepad",
        "Maze Chase must support keyboard and standard gamepad input",
      );
      assert(
        MAZE_CHASE_METADATA.assetManifest === "assets.json",
        "game assets must remain owned by the Maze Chase module",
      );
    },
  },
  {
    name: "P10-009 difficulty and level progression are monotonic and bounded",
    run: () => {
      assert(
        MAZE_CHASE_METADATA.defaultDifficulty === MAZE_CHASE_DEFAULT_DIFFICULTY,
        "metadata default must match the canonical design table",
      );
      assert(
        MAZE_CHASE_METADATA.difficulties.map((entry) => entry.id).join(",") ===
          Object.keys(MAZE_CHASE_DIFFICULTIES).join(","),
        "metadata difficulty IDs must come from one gameplay table",
      );
      assert(
        MAZE_CHASE_DIFFICULTIES.stroll.enemySpeed <
          MAZE_CHASE_DIFFICULTIES.circuit.enemySpeed &&
          MAZE_CHASE_DIFFICULTIES.circuit.enemySpeed <
            MAZE_CHASE_DIFFICULTIES.overdrive.enemySpeed,
        "sentinel pressure must rise by difficulty",
      );
      assert(
        MAZE_CHASE_DIFFICULTIES.stroll.vulnerabilitySeconds >
          MAZE_CHASE_DIFFICULTIES.circuit.vulnerabilitySeconds &&
          MAZE_CHASE_DIFFICULTIES.circuit.vulnerabilitySeconds >
            MAZE_CHASE_DIFFICULTIES.overdrive.vulnerabilitySeconds,
        "harder modes must not extend the power window",
      );
      assert(
        mazeChaseLevelSpeedScale(1) === 1 &&
          mazeChaseLevelSpeedScale(100) === MAZE_CHASE_RUN_RULES.maxLevelSpeedScale,
        "level speed progression must start neutral and respect its cap",
      );
      assert(
        mazeChaseLevelClearScore(3) > mazeChaseLevelClearScore(1) &&
          MAZE_CHASE_SCORING.enemyCaptureBase > MAZE_CHASE_SCORING.powerItem,
        "progression and capture rewards must use deterministic project-owned values",
      );
    },
  },
  {
    name: "P10-011 user-facing metadata avoids commercial reference branding",
    run: () => {
      const userFacing = JSON.stringify(MAZE_CHASE_METADATA).toLowerCase();
      for (const prohibited of ["pac-man", "namco", "blinky", "pinky", "inky", "clyde"]) {
        assert(
          !userFacing.includes(prohibited),
          `user-facing metadata must not contain commercial reference term ${prohibited}`,
        );
      }
    },
  },
];
