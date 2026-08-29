import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_RUN_RULES } from "./design.js";
import type { StarDefenderPlayerState } from "./player.js";
import {
  StarDefenderSimulation,
  type StarDefenderEnemy,
  type StarDefenderFrameInput,
  type StarDefenderInhabitant,
} from "./simulation.js";
import { starDefenderTerrainY } from "./world.js";

const NEUTRAL: StarDefenderFrameInput = Object.freeze({
  horizontal: 0,
  vertical: 0,
  fire: false,
  emergency: false,
});

function player(x: number, y: number, facing: -1 | 1 = 1): StarDefenderPlayerState {
  return Object.freeze({
    x,
    y,
    velocityX: 0,
    velocityY: 0,
    facing,
  });
}

function enemy(
  id: number,
  type: StarDefenderEnemy["type"],
  x: number,
  y: number,
  options: Partial<Pick<StarDefenderEnemy, "carryingInhabitantId" | "targetInhabitantId">> = {},
): StarDefenderEnemy {
  return Object.freeze({
    id,
    type,
    x,
    y,
    heading: 1,
    phase: 0,
    ageSeconds: 0,
    targetInhabitantId: options.targetInhabitantId ?? null,
    carryingInhabitantId: options.carryingInhabitantId ?? null,
  });
}

function inhabitant(
  id: number,
  x: number,
  state: StarDefenderInhabitant["state"] = "ground",
  y = starDefenderTerrainY(x) - 3,
): StarDefenderInhabitant {
  return Object.freeze({
    id,
    x,
    y,
    state,
    carrierEnemyId: null,
    velocityY: state === "falling" ? 16 : 0,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "P15-004 forward lance destroys only through the canonical wrapped simulation",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(15),
        difficulty: "frontier",
        initialPlayer: player(100, 118, 1),
        initialEnemies: [enemy(1, "stalker", 112, 118)],
        initialInhabitants: [inhabitant(1, 700)],
        initialInvulnerabilitySeconds: 10,
      });

      const events = simulation.update({ ...NEUTRAL, fire: true }, 0);
      assert(
        events.some(
          (event) =>
            event.type === "enemy-destroyed" &&
            event.enemyType === "stalker" &&
            event.cause === "lance",
        ),
        "forward lance must resolve a nearby enemy hit",
      );
      assert(
        simulation.projectiles.length === 0,
        "the projectile must be consumed by its hit",
      );
    },
  },
  {
    name: "P15-005 held emergency input consumes at most one charge until released",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(151),
        difficulty: "patrol",
        initialPlayer: player(100, 100),
        initialEnemies: [enemy(1, "skimmer", 900, 100)],
        initialInhabitants: [inhabitant(1, 600)],
        initialEmergencyCharges: 2,
        initialInvulnerabilitySeconds: 10,
      });

      const first = simulation.update({ ...NEUTRAL, emergency: true }, 0);
      const afterFirst = simulation.emergencyCharges;
      const second = simulation.update({ ...NEUTRAL, emergency: true }, 0);
      assert(
        first.filter((event) => event.type === "emergency-used").length === 1,
        "first emergency press must emit exactly one use",
      );
      assert(
        second.every((event) => event.type !== "emergency-used"),
        "held input must not emit a second emergency use",
      );
      assert(
        simulation.emergencyCharges === afterFirst,
        "held input must not spend another charge",
      );
    },
  },
  {
    name: "CR-006 using emergency to clear the wave does not refund the charge it just spent",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(151),
        difficulty: "patrol",
        initialPlayer: player(100, 100),
        // A single enemy so the emergency burst wipes the entire wave in one press.
        initialEnemies: [enemy(1, "skimmer", 900, 100)],
        initialInhabitants: [inhabitant(1, 600)],
        initialEmergencyCharges: 2,
        initialInvulnerabilitySeconds: 10,
      });

      const events = simulation.update({ ...NEUTRAL, emergency: true }, 0);
      assert(
        events.some((event) => event.type === "wave-cleared"),
        "wiping the only enemy must clear the wave in the same tick the emergency fired",
      );
      assert(
        simulation.emergencyCharges === 1,
        `emergency must cost exactly one charge even when it clears the wave, got ${simulation.emergencyCharges}`,
      );
    },
  },
  {
    name: "CR-006 an ordinary combat wave clear still refunds a charge",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(151),
        difficulty: "patrol",
        initialPlayer: player(100, 118, 1),
        initialEnemies: [enemy(1, "stalker", 112, 118)],
        initialInhabitants: [inhabitant(1, 600)],
        initialEmergencyCharges: 1,
        initialInvulnerabilitySeconds: 10,
      });

      const events = simulation.update({ ...NEUTRAL, fire: true }, 0);
      assert(
        events.some((event) => event.type === "wave-cleared"),
        "destroying the only enemy by lance fire must clear the wave",
      );
      assert(
        simulation.emergencyCharges === 2,
        `a combat-caused wave clear must still refund a charge, got ${simulation.emergencyCharges}`,
      );
    },
  },
  {
    name: "P15-007/P15-008 rescue sequence advances abduction falling catch and return states",
    run: () => {
      const x = 500;
      const groundY = starDefenderTerrainY(x) - 3;
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(152),
        difficulty: "frontier",
        initialPlayer: player(x, groundY - 12),
        initialEnemies: [enemy(1, "snatcher", x, groundY - 11)],
        initialInhabitants: [inhabitant(1, x)],
        initialInvulnerabilitySeconds: 10,
      });

      const abduct = simulation.update(NEUTRAL, 0);
      assert(
        simulation.inhabitants[0]?.state === "abducted" &&
          abduct.some((event) => event.type === "abduction-started"),
        "snatcher at capture altitude must abduct the grounded settler",
      );

      const releaseAndCatch = simulation.update({ ...NEUTRAL, emergency: true }, 0);
      assert(
        releaseAndCatch.some((event) => event.type === "inhabitant-falling"),
        "destroying the carrier must explicitly release a falling settler",
      );
      assert(
        releaseAndCatch.some((event) => event.type === "inhabitant-caught") &&
          String(simulation.inhabitants[0]?.state) === "carried",
        "player overlap must catch the released falling settler",
      );

      const returned = simulation.update(NEUTRAL, 0);
      assert(
        returned.some((event) => event.type === "inhabitant-returned") &&
          String(simulation.inhabitants[0]?.state) === "ground",
        "descending near terrain with a carried settler must return it safely",
      );
    },
  },
  {
    name: "P15-009 off-screen stalker takes the shortest wrapped route across the seam",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(153),
        difficulty: "frontier",
        initialPlayer: player(STAR_DEFENDER_RUN_RULES.worldWidth - 8, 100),
        initialEnemies: [enemy(1, "stalker", 8, 100)],
        initialInhabitants: [inhabitant(1, 500)],
        initialInvulnerabilitySeconds: 10,
      });

      simulation.update(NEUTRAL, 1 / 60);
      const stalker = simulation.enemies.find((entry) => entry.id === 1);
      assert(stalker !== undefined, "fixture stalker must remain active");
      assert(
        stalker.heading === -1 && stalker.x < 8,
        "off-screen pursuit must cross the nearby seam instead of traversing the long way",
      );
    },
  },
  {
    name: "P15-010 wave and projectile populations stay within explicit density limits",
    run: () => {
      const simulation = new StarDefenderSimulation({
        rng: new SeededRandomService(154),
        difficulty: "siege",
        initialPlayer: player(100, 100),
        initialEnemies: [enemy(1, "skimmer", 1000, 100)],
        initialInhabitants: [inhabitant(1, 700)],
        initialInvulnerabilitySeconds: 100,
      });

      let maximumEnemies = simulation.enemies.length;
      let maximumProjectiles = 0;
      for (let index = 0; index < 40; index += 1) {
        simulation.update({ ...NEUTRAL, emergency: true }, 0);
        maximumEnemies = Math.max(maximumEnemies, simulation.enemies.length);
        simulation.update(NEUTRAL, 0);
      }
      for (let index = 0; index < 600; index += 1) {
        simulation.update({ ...NEUTRAL, fire: true }, 1 / 60);
        maximumProjectiles = Math.max(maximumProjectiles, simulation.projectiles.length);
        if (simulation.gameOver) {
          break;
        }
      }

      assert(
        maximumEnemies <= STAR_DEFENDER_RUN_RULES.maxEnemies,
        "wave progression must never exceed the enemy density cap",
      );
      assert(
        maximumProjectiles <= STAR_DEFENDER_RUN_RULES.maxProjectiles,
        "held fire must never exceed the projectile cap",
      );
    },
  },
  {
    name: "P15-011 identical seed and fixed input stream reproduce canonical world state",
    run: () => {
      const simulate = () => {
        const simulation = new StarDefenderSimulation({
          rng: new SeededRandomService(0x15def),
          difficulty: "frontier",
          initialInvulnerabilitySeconds: 100,
        });
        for (let frame = 0; frame < 180; frame += 1) {
          simulation.update(
            {
              horizontal: frame % 80 < 40 ? 1 : -1,
              vertical: frame % 60 < 20 ? -1 : frame % 60 < 40 ? 0 : 1,
              fire: frame % 5 === 0,
              emergency: false,
            },
            1 / 60,
          );
        }
        return JSON.stringify({
          player: simulation.player,
          enemies: simulation.enemies,
          inhabitants: simulation.inhabitants,
          projectiles: simulation.projectiles,
          score: simulation.score,
          wave: simulation.wave,
        });
      };

      assert(
        simulate() === simulate(),
        "seeded world generation and fixed-step rules must reproduce exactly",
      );
    },
  },
  {
    name: "P15-010 final hull loss and total settler loss each produce one terminal event",
    run: () => {
      const collision = new StarDefenderSimulation({
        rng: new SeededRandomService(155),
        difficulty: "frontier",
        initialPlayer: player(300, 100),
        initialEnemies: [enemy(1, "stalker", 300, 100)],
        initialInhabitants: [inhabitant(1, 800)],
        initialLives: 1,
        initialInvulnerabilitySeconds: 0,
      });
      const collisionEvents = collision.update(NEUTRAL, 0);
      assert(collision.gameOver && collision.lives === 0, "last hull hit must end the run");
      assert(
        collisionEvents.filter((event) => event.type === "game-over").length === 1,
        "terminal hull loss must emit exactly one game-over event",
      );

      const x = 900;
      const objective = new StarDefenderSimulation({
        rng: new SeededRandomService(156),
        difficulty: "frontier",
        initialPlayer: player(100, 100),
        initialEnemies: [enemy(1, "skimmer", 1200, 90)],
        initialInhabitants: [inhabitant(1, x, "falling", starDefenderTerrainY(x) - 3)],
        initialInvulnerabilitySeconds: 100,
      });
      const objectiveEvents = objective.update(NEUTRAL, 0.01);
      assert(objective.gameOver, "losing the last settler must end the defense run");
      assert(
        objectiveEvents.filter((event) => event.type === "game-over").length === 1,
        "objective loss must emit exactly one game-over event",
      );
      assert(
        objective.update(NEUTRAL, 1).length === 0,
        "terminal simulation must stop producing gameplay events",
      );
    },
  },
];
