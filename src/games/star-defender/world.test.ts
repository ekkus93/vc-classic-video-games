import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_RUN_RULES } from "./design.js";
import {
  starDefenderCameraCenterX,
  starDefenderRadarX,
  starDefenderTerrainY,
  starDefenderWorldToScreenX,
  wrapStarDefenderWorldX,
  wrappedStarDefenderDeltaX,
} from "./world.js";

function near(actual: number, expected: number, epsilon = 1e-9): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

export const tests: readonly TestCase[] = [
  {
    name: "P15-002 canonical horizontal world wraps overshoot in both directions",
    run: () => {
      assert(
        wrapStarDefenderWorldX(-3) === STAR_DEFENDER_RUN_RULES.worldWidth - 3,
        "negative world coordinates must preserve overshoot across the seam",
      );
      assert(
        wrapStarDefenderWorldX(STAR_DEFENDER_RUN_RULES.worldWidth + 7) === 7,
        "positive world coordinates must preserve overshoot across the seam",
      );
      assert(
        wrappedStarDefenderDeltaX(STAR_DEFENDER_RUN_RULES.worldWidth - 8, 8) === 16,
        "shortest wrapped delta must cross the seam instead of traversing the full world",
      );
    },
  },
  {
    name: "P15-003 terrain camera and radar use the same seamless canonical coordinates",
    run: () => {
      assert(
        near(
          starDefenderTerrainY(0),
          starDefenderTerrainY(STAR_DEFENDER_RUN_RULES.worldWidth),
        ),
        "procedural terrain must be exactly periodic at the world seam",
      );
      const camera = starDefenderCameraCenterX(
        STAR_DEFENDER_RUN_RULES.worldWidth - 10,
        1,
      );
      const screenX = starDefenderWorldToScreenX(12, camera);
      assert(
        screenX > 0 && screenX < STAR_DEFENDER_RUN_RULES.logicalWidth,
        "an entity across the wrap seam must remain in the nearby camera view",
      );
      assert(
        near(
          starDefenderRadarX(0, 6, 308),
          starDefenderRadarX(STAR_DEFENDER_RUN_RULES.worldWidth, 6, 308),
        ),
        "radar projection must wrap the same canonical world seam",
      );
    },
  },
];
