import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_PLAYER_RULES, STAR_DEFENDER_RUN_RULES } from "./design.js";
import {
  createStarDefenderPlayer,
  stepStarDefenderPlayer,
} from "./player.js";
import { starDefenderTerrainY } from "./world.js";

export const tests: readonly TestCase[] = [
  {
    name: "P15-004 directional thrust changes facing without discarding inertial velocity",
    run: () => {
      let player = createStarDefenderPlayer(500);
      player = stepStarDefenderPlayer(
        player,
        { horizontal: 1, vertical: -1 },
        0.2,
      );
      const movingVelocity = player.velocityX;
      player = stepStarDefenderPlayer(
        player,
        { horizontal: 0, vertical: 0 },
        0.1,
      );
      assert(player.facing === 1, "coasting must preserve the selected facing direction");
      assert(
        player.velocityX > 0 && player.velocityX < movingVelocity,
        "coasting must retain damped inertia rather than zeroing velocity",
      );
    },
  },
  {
    name: "P15-004 sustained flight is explicitly speed and terrain bounded",
    run: () => {
      let player = createStarDefenderPlayer(STAR_DEFENDER_RUN_RULES.worldWidth - 2);
      for (let index = 0; index < 2400; index += 1) {
        player = stepStarDefenderPlayer(
          player,
          { horizontal: 1, vertical: 1 },
          1 / 60,
        );
      }
      assert(
        Math.abs(player.velocityX) <= STAR_DEFENDER_PLAYER_RULES.maxHorizontalSpeed + 1e-9,
        "horizontal thrust must not exceed the design speed cap",
      );
      assert(
        Math.abs(player.velocityY) <= STAR_DEFENDER_PLAYER_RULES.maxVerticalSpeed + 1e-9,
        "vertical thrust must not exceed the design speed cap",
      );
      assert(
        player.x >= 0 && player.x < STAR_DEFENDER_RUN_RULES.worldWidth,
        "player position must remain in canonical wrapped coordinates",
      );
      assert(
        player.y <= starDefenderTerrainY(player.x) - 11 + 1e-9,
        "player must not tunnel below the terrain flight ceiling",
      );
    },
  },
];
