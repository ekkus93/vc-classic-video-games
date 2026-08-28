import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import type { SpaceRocksRock } from "./rocks.js";
import { SpaceRocksSimulation } from "./simulation.js";

const NEUTRAL_INPUT = Object.freeze({
  rotate: 0 as const,
  thrust: false,
  fire: false,
});

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
    name: "P7-006 spawn protection prevents immediate and repeat hull loss",
    run: () => {
      const simulation = new SpaceRocksSimulation({
        rng: new SeededRandomService(1),
        difficulty: "orbit",
        initialRocks: [stationaryRock(1, "small", 160, 120)],
        initialInvulnerabilitySeconds: 0.5,
      });

      simulation.update(NEUTRAL_INPUT, 0.25);
      assert(simulation.lives === 3, "protected spawn must ignore overlapping hazard");
      const events = simulation.update(NEUTRAL_INPUT, 0.25);
      assert(
        Number(simulation.lives) === 2,
        "collision must cost one hull when protection expires",
      );
      assert(
        events.some((event) => event.type === "ship-hit"),
        "hull loss must emit a ship-hit event",
      );
      assert(
        simulation.invulnerabilitySeconds > 0,
        "respawn must restore a non-zero protection window",
      );

      simulation.update(NEUTRAL_INPUT, 0.01);
      assert(
        Number(simulation.lives) === 2,
        "overlapping respawn hazard must not cause immediate repeat death",
      );
    },
  },
  {
    name: "P7-006 final hull loss produces one terminal game-over state",
    run: () => {
      const simulation = new SpaceRocksSimulation({
        rng: new SeededRandomService(2),
        difficulty: "nova",
        initialRocks: [stationaryRock(1, "large", 160, 120)],
        initialLives: 1,
        initialInvulnerabilitySeconds: 0,
      });

      const events = simulation.update(NEUTRAL_INPUT, 1 / 60);
      assert(simulation.gameOver, "last hull collision must end the run");
      assert(simulation.lives === 0, "terminal collision must consume the final hull");
      assert(
        events.filter((event) => event.type === "game-over").length === 1,
        "terminal update must emit exactly one game-over event",
      );
      assert(
        simulation.update(NEUTRAL_INPUT, 1).length === 0,
        "game-over simulation must stop producing gameplay events",
      );
    },
  },
  {
    name: "P7-007 projectile destruction awards the canonical rock score",
    run: () => {
      const simulation = new SpaceRocksSimulation({
        rng: new SeededRandomService(3),
        difficulty: "orbit",
        initialRocks: [
          stationaryRock(1, "small", 160, 101),
          stationaryRock(2, "large", 20, 20),
        ],
      });

      const events = simulation.update(
        { rotate: 0, thrust: false, fire: true },
        0.05,
      );
      assert(simulation.score === 225, "small fracture rock must award 225 points");
      assert(
        events.some(
          (event) =>
            event.type === "rock-fractured" &&
            event.size === "small" &&
            event.points === 225,
        ),
        "rock destruction must emit its scoring event",
      );
    },
  },
  {
    name: "P7-007 clearing a wave awards bonus and advances seeded wave progression",
    run: () => {
      const simulation = new SpaceRocksSimulation({
        rng: new SeededRandomService(4),
        difficulty: "drift",
        initialRocks: [],
      });

      const events = simulation.update(NEUTRAL_INPUT, 0);
      assert(simulation.score === 300, "first wave clear must award the canonical 300 bonus");
      assert(simulation.wave === 2, "clearing wave one must advance to wave two");
      assert(simulation.rocks.length === 3, "drift wave two must generate its bounded initial field");
      assert(
        events.some(
          (event) =>
            event.type === "wave-cleared" && event.wave === 1 && event.bonus === 300,
        ),
        "wave progression must emit an explicit scoring event",
      );
    },
  },
];
