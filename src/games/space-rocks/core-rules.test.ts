import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { SpaceRocksRockFactory, type SpaceRocksRock } from "./rocks.js";
import { createSpaceRocksShip, stepSpaceRocksShip } from "./ship.js";
import { SpaceRocksSimulation } from "./simulation.js";
import { advanceWrappedSpaceRocksPosition } from "./world.js";

function stationaryRock(
  id: number,
  size: SpaceRocksRock["size"],
  x: number,
  y: number,
): SpaceRocksRock {
  return Object.freeze({
    id,
    size,
    position: Object.freeze({ x, y }),
    velocity: Object.freeze({ x: 0, y: 0 }),
    rotationRadians: 0,
    angularVelocityRadiansPerSecond: 0,
    shapeSeed: id,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P7-009 headless core-rule matrix covers motion wrapping splits collisions and scoring",
    run: () => {
      const initialShip = createSpaceRocksShip({ x: 160, y: 120 });
      const movedShip = stepSpaceRocksShip(
        initialShip,
        { rotate: 1, thrust: true },
        0.25,
      );
      assert(
        movedShip.facingRadians !== initialShip.facingRadians,
        "rotation must change facing in the headless physics path",
      );
      assert(
        movedShip.velocity.x !== 0 || movedShip.velocity.y !== 0,
        "thrust must create inertial velocity in the headless physics path",
      );

      const wrapped = advanceWrappedSpaceRocksPosition(
        { x: 319, y: 120 },
        { x: 10, y: 0 },
        0.2,
      );
      assert(
        Math.abs(wrapped.x - 1) < 1e-9 && wrapped.y === 120,
        "wrapped motion must preserve boundary overshoot",
      );

      const parent = Object.freeze({
        id: 1,
        size: "large" as const,
        position: Object.freeze({ x: 70, y: 80 }),
        velocity: Object.freeze({ x: 12, y: -3 }),
        rotationRadians: 0.25,
        angularVelocityRadiansPerSecond: 0.4,
        shapeSeed: 0x1234,
      });
      const firstSplit = new SpaceRocksRockFactory(
        new SeededRandomService(0x5eed),
        "orbit",
      ).split(parent);
      const secondSplit = new SpaceRocksRockFactory(
        new SeededRandomService(0x5eed),
        "orbit",
      ).split(parent);
      assert(
        firstSplit.length === 2 && firstSplit.every((rock) => rock.size === "medium"),
        "large rocks must split into exactly two medium fragments",
      );
      assert(
        JSON.stringify(firstSplit) === JSON.stringify(secondSplit),
        "fixed seed must reproduce the exact split result headlessly",
      );

      const scoring = new SpaceRocksSimulation({
        rng: new SeededRandomService(3),
        difficulty: "orbit",
        initialRocks: [
          stationaryRock(1, "small", 160, 101),
          stationaryRock(2, "large", 20, 20),
        ],
      });
      scoring.update({ rotate: 0, thrust: false, fire: true }, 0.05);
      assert(
        scoring.score === 225,
        "projectile collision must award the canonical small-rock score",
      );

      const collision = new SpaceRocksSimulation({
        rng: new SeededRandomService(9),
        difficulty: "orbit",
        initialRocks: [stationaryRock(1, "small", 160, 120)],
        initialInvulnerabilitySeconds: 0,
      });
      const hitEvents = collision.update(
        { rotate: 0, thrust: false, fire: false },
        1 / 60,
      );
      assert(
        collision.lives === 2 && hitEvents.some((event) => event.type === "ship-hit"),
        "ship/rock collision must consume exactly one hull and emit its event",
      );
    },
  },
];
