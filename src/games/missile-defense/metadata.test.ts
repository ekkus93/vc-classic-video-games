import { assert, type TestCase } from "../../test/harness.js";
import {
  MISSILE_DEFENSE_DEFAULT_DIFFICULTY,
  MISSILE_DEFENSE_DIFFICULTIES,
  MISSILE_DEFENSE_RUN_RULES,
  missileDefenseEnemyCount,
  missileDefenseWaveBonus,
} from "./design.js";
import { MISSILE_DEFENSE_METADATA } from "./metadata.js";

export const tests: readonly TestCase[] = [
  {
    name: "P8-001 Missile Defense metadata declares clean-room controls and logical battlefield",
    run: () => {
      assert(MISSILE_DEFENSE_METADATA.id === "missile-defense", "stable game id");
      assert(MISSILE_DEFENSE_METADATA.title === "Missile Defense", "canonical title");
      assert(
        MISSILE_DEFENSE_METADATA.supportedInputs.join(",") === "keyboard,gamepad,pointer",
        "pointer and controller inputs must be first-class",
      );
      assert(
        MISSILE_DEFENSE_METADATA.logicalWidth === MISSILE_DEFENSE_RUN_RULES.logicalWidth &&
          MISSILE_DEFENSE_METADATA.logicalHeight === MISSILE_DEFENSE_RUN_RULES.logicalHeight,
        "metadata must match the logical simulation field",
      );
      assert(
        MISSILE_DEFENSE_METADATA.defaultDifficulty === MISSILE_DEFENSE_DEFAULT_DIFFICULTY &&
          MISSILE_DEFENSE_METADATA.difficulties.length === Object.keys(MISSILE_DEFENSE_DIFFICULTIES).length,
        "difficulty metadata must come from one canonical design table",
      );
      assert(
        !JSON.stringify(MISSILE_DEFENSE_METADATA).toLowerCase().includes("missile command"),
        "user-facing metadata must not expose reference-game branding",
      );
    },
  },
  {
    name: "P8-001 scoring and pressure progression are deterministic and bounded",
    run: () => {
      assert(missileDefenseWaveBonus(1) === 180, "wave one uses project-owned base bonus");
      assert(missileDefenseWaveBonus(4) === 345, "wave bonus advances deterministically");
      assert(
        missileDefenseEnemyCount("guard", 1) < missileDefenseEnemyCount("guard", 4),
        "later waves increase pressure",
      );
      assert(missileDefenseEnemyCount("siege", 1000) === 28, "hostile wave size has a hard cap");
    },
  },
];
