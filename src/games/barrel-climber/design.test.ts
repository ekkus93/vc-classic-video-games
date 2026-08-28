import { assert, type TestCase } from "../../test/harness.js";
import {
  BARREL_CLIMBER_DIFFICULTIES,
  BARREL_CLIMBER_RUN_RULES,
  BARREL_CLIMBER_SCORING,
  barrelClimberStageClearScore,
} from "./design.js";
import { BARREL_CLIMBER_STAGES, validateBarrelClimberStage } from "./stages.js";

export const tests: readonly TestCase[] = [
  {
    name: "P16-001/P16-008 Barrel Climber defines three original validated stage variations",
    run: () => {
      assert(BARREL_CLIMBER_STAGES.length === 3, "release-one Barrel Climber must ship three stages");
      assert(new Set(BARREL_CLIMBER_STAGES.map((stage) => stage.id)).size === 3, "stage IDs must be unique");
      for (const stage of BARREL_CLIMBER_STAGES) {
        validateBarrelClimberStage(stage);
        assert(stage.platforms.length >= 5, `${stage.id} must provide layered traversal geometry`);
        assert(stage.ladders.length >= 5, `${stage.id} must provide multiple ladder choices`);
        assert(stage.mechanic.length > 20, `${stage.id} must document its mechanical variation`);
      }
      assert(
        new Set(BARREL_CLIMBER_STAGES.map((stage) => stage.palette.background)).size === 3,
        "each stage must have a distinct project-authored palette",
      );
    },
  },
  {
    name: "P16-009 canonical difficulty and scoring tables are bounded and progression-aware",
    run: () => {
      assert(Object.keys(BARREL_CLIMBER_DIFFICULTIES).length === 3, "three difficulty profiles are required");
      assert(BARREL_CLIMBER_RUN_RULES.maxHazards === 12, "hazard population must have a hard cap");
      assert(BARREL_CLIMBER_SCORING.vaultHazard === 120, "vault scoring must use the canonical table");
      assert(barrelClimberStageClearScore(0, 1) === 700, "first-stage base bonus must be deterministic");
      assert(barrelClimberStageClearScore(2, 2) > barrelClimberStageClearScore(0, 1), "later progression must award a larger clear bonus");
    },
  },
];
