import { assert, type TestCase } from "../../test/harness.js";
import {
  createSpaceRocksShip,
  stepSpaceRocksShip,
} from "./ship.js";

function near(actual: number, expected: number, epsilon = 1e-9): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

export const tests: readonly TestCase[] = [
  {
    name: "P7-002 ship rotation changes facing without rotating existing velocity",
    run: () => {
      let ship = createSpaceRocksShip({ x: 160, y: 120 });
      ship = stepSpaceRocksShip(ship, { rotate: 0, thrust: true }, 0.5);
      const velocityBeforeTurn = ship.velocity;
      ship = stepSpaceRocksShip(ship, { rotate: 1, thrust: false }, 0.25);

      assert(ship.facingRadians > 0, "rotation input must change facing");
      assert(
        near(ship.velocity.x, velocityBeforeTurn.x) &&
          near(ship.velocity.y, velocityBeforeTurn.y),
        "coasting rotation must not rotate the ship's inertial velocity",
      );
      assert(ship.position.y < 120, "existing velocity must continue moving the craft");
    },
  },
  {
    name: "P7-002 fixed input sequence produces deterministic ship motion",
    run: () => {
      const simulate = () => {
        let ship = createSpaceRocksShip({ x: 160, y: 120 });
        const inputs = [
          { rotate: 0 as const, thrust: true },
          { rotate: 1 as const, thrust: true },
          { rotate: 1 as const, thrust: false },
          { rotate: -1 as const, thrust: false },
        ];
        for (const input of inputs) {
          ship = stepSpaceRocksShip(ship, input, 1 / 60);
        }
        return ship;
      };

      const first = simulate();
      const second = simulate();
      assert(JSON.stringify(first) === JSON.stringify(second), "identical inputs must reproduce exactly");
      assert(
        first.facingRadians !== 0 &&
          (first.velocity.x !== 0 || first.velocity.y !== 0),
        "fixture must exercise both facing and velocity",
      );
    },
  },
  {
    name: "P7-002 ship velocity is explicitly bounded",
    run: () => {
      let ship = createSpaceRocksShip({ x: 0, y: 0 });
      for (let index = 0; index < 6000; index += 1) {
        ship = stepSpaceRocksShip(ship, { rotate: 0, thrust: true }, 1 / 60);
      }
      const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
      assert(speed <= 92 + 1e-9, "sustained thrust must not exceed the design speed bound");
    },
  },
];
