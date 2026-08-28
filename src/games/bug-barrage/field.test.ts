import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_LIMITS, BUG_BARRAGE_RUN_RULES } from "./design.js";
import {
  createBugBarrageField,
  damageBugBarrageObstacle,
  repairBugBarrageObstacle,
} from "./field.js";

function signature(seed: number): string {
  const rng = new SeededRandomService(seed);
  return JSON.stringify(createBugBarrageField(rng, 12));
}

export const tests: readonly TestCase[] = [
  {
    name: "P11-003 field generation is seeded deterministic and hard bounded",
    run: () => {
      assert(signature(0x1103) === signature(0x1103), "same seed must reproduce the field");
      assert(signature(0x1103) !== signature(0x2203), "different seeds should alter field order");
      const field = createBugBarrageField(
        new SeededRandomService(1),
        BUG_BARRAGE_LIMITS.maxObstacles + 100,
      );
      assert(
        field.length === BUG_BARRAGE_LIMITS.maxObstacles,
        "field generation must enforce the obstacle cap",
      );
    },
  },
  {
    name: "P11-003 signal pods are destructible and repairable without exceeding max health",
    run: () => {
      let field = createBugBarrageField(new SeededRandomService(7), 1);
      const pod = field[0];
      assert(pod !== undefined, "fixture must create a pod");
      const first = damageBugBarrageObstacle(field, pod.id);
      field = first.obstacles;
      assert(!first.destroyed, "first hit must damage rather than destroy a full pod");
      assert(
        field[0]?.health === BUG_BARRAGE_RUN_RULES.maxObstacleHealth - 1,
        "damage must reduce health exactly once",
      );
      field = repairBugBarrageObstacle(field, pod.id);
      field = repairBugBarrageObstacle(field, pod.id);
      assert(
        field[0]?.health === BUG_BARRAGE_RUN_RULES.maxObstacleHealth,
        "repair must restore but never exceed canonical max health",
      );
      for (let index = 0; index < BUG_BARRAGE_RUN_RULES.maxObstacleHealth; index += 1) {
        const result = damageBugBarrageObstacle(field, pod.id);
        field = result.obstacles;
      }
      assert(field.length === 0, "enough hits must remove a pod from topology");
    },
  },
];
