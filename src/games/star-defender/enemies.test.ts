import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import {
  starDefenderWaveEnemyCount,
  STAR_DEFENDER_RUN_RULES,
} from "./design.js";
import {
  createStarDefenderWave,
  updateStarDefenderEnemies,
  type StarDefenderEnemy,
} from "./enemies.js";
import type { StarDefenderInhabitant } from "./inhabitants.js";
import type { StarDefenderPlayerState } from "./player.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";
import { starDefenderTerrainY, wrapStarDefenderWorldX } from "./world.js";

function player(x: number, y: number): StarDefenderPlayerState {
  return Object.freeze({ x, y, velocityX: 0, velocityY: 0, facing: 1 });
}

function ground(id: number, x: number): StarDefenderInhabitant {
  return Object.freeze({
    id,
    x,
    y: starDefenderTerrainY(x) - 3,
    state: "ground",
    carrierEnemyId: null,
    velocityY: 0,
  });
}

function enemy(
  type: StarDefenderEnemy["type"],
  x: number,
  y: number,
  overrides: Partial<StarDefenderEnemy> = {},
): StarDefenderEnemy {
  return Object.freeze({
    id: 1,
    type,
    x,
    y,
    heading: 1,
    phase: 0,
    ageSeconds: 0,
    targetInhabitantId: null,
    carryingInhabitantId: null,
    ...overrides,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "TC-001 createStarDefenderWave picks enemy type from a wave-dependent offset, not index alone",
    run: () => {
      // Same index (4), same difficulty (patrol), different waves -- the selector formula is
      // (index + wave) % 6, so the type at a fixed index must differ across waves if the wave
      // term is actually contributing rather than being ignored.
      const waveOne = createStarDefenderWave(new SeededRandomService(1), "patrol", 1, 1);
      const waveTwo = createStarDefenderWave(new SeededRandomService(1), "patrol", 2, 1);
      assert(
        waveOne.enemies.length > 4 && waveTwo.enemies.length > 4,
        "fixture premise: both waves must generate at least 5 enemies to have an index-4 entry",
      );
      const typeAtIndex4Wave1 = waveOne.enemies[4]?.type;
      const typeAtIndex4Wave2 = waveTwo.enemies[4]?.type;
      assert(
        typeAtIndex4Wave1 === "skimmer" && typeAtIndex4Wave2 === "snatcher",
        `expected index 4 to be skimmer at wave 1 and snatcher at wave 2, got ${typeAtIndex4Wave1} and ${typeAtIndex4Wave2}`,
      );
    },
  },
  {
    name: "TC-001 createStarDefenderWave generates exactly starDefenderWaveEnemyCount enemies per difficulty",
    run: () => {
      const cases: ReadonlyArray<{
        readonly difficulty: "patrol" | "frontier" | "siege";
        readonly wave: number;
      }> = [
        { difficulty: "patrol", wave: 2 },
        { difficulty: "frontier", wave: 1 },
        { difficulty: "siege", wave: 3 },
      ];
      for (const { difficulty, wave } of cases) {
        const result = createStarDefenderWave(new SeededRandomService(7), difficulty, wave, 1);
        const expected = starDefenderWaveEnemyCount(wave, difficulty);
        assert(
          result.enemies.length === expected,
          `${difficulty} wave ${wave}: expected ${expected} enemies, got ${result.enemies.length}`,
        );
      }
    },
  },
  {
    name: "TC-001 createStarDefenderWave is reproducible under a fixed seed",
    run: () => {
      const first = createStarDefenderWave(new SeededRandomService(0x5eed), "frontier", 3, 10);
      const second = createStarDefenderWave(new SeededRandomService(0x5eed), "frontier", 3, 10);
      assert(
        JSON.stringify(first) === JSON.stringify(second),
        "the same seed, difficulty, wave, and startId must produce byte-identical waves",
      );
    },
  },
  {
    name: "TC-001 createStarDefenderWave assigns a contiguous, non-overlapping id range across chained calls",
    run: () => {
      const first = createStarDefenderWave(new SeededRandomService(3), "siege", 1, 5);
      assert(
        first.nextEnemyId === 5 + first.enemies.length,
        `nextEnemyId must be startId + count, got ${first.nextEnemyId} for count ${first.enemies.length}`,
      );
      assertDeepEqual(
        first.enemies.map((e) => e.id),
        Array.from({ length: first.enemies.length }, (_, i) => 5 + i),
        "ids must be the contiguous range [startId, startId + count)",
      );

      const second = createStarDefenderWave(
        new SeededRandomService(4),
        "siege",
        2,
        first.nextEnemyId,
      );
      assert(
        second.enemies[0]?.id === first.nextEnemyId,
        "a chained call must continue from the previous call's nextEnemyId with no gap or reuse",
      );
    },
  },
  {
    name: "TC-001 a lone stalker turns toward the player across the world-wrap seam and closes altitude",
    run: () => {
      // Mirrors simulation.test.ts's P15-009 seam fixture, but calls the extracted function
      // directly instead of going through the whole simulation.
      const width = STAR_DEFENDER_RUN_RULES.worldWidth;
      const stalker = enemy("stalker", 8, 100, { heading: 1 });
      const result = updateStarDefenderEnemies(
        [stalker],
        [],
        player(width - 8, 130),
        "frontier",
        1 / 60,
        [],
      );
      const stepped = result[0];
      assert(stepped !== undefined, "the stepped stalker must survive one tick");
      assert(
        stepped.heading === -1 && stepped.x < 8,
        "off-screen pursuit must cross the nearby seam instead of the long way around",
      );
      assert(
        stepped.y > 100 && stepped.y <= 130,
        "the stalker must close vertical distance toward the player without overshooting in one tick",
      );
    },
  },
  {
    name: "TC-001 a lone skimmer moves horizontally by its own heading and tracks its sinusoidal altitude target gradually",
    run: () => {
      const skimmer = enemy("skimmer", 500, 200, { heading: 1, phase: 0, ageSeconds: 0 });
      const result = updateStarDefenderEnemies(
        [skimmer],
        [],
        player(0, 0),
        "frontier",
        1 / 60,
        [],
      );
      const stepped = result[0];
      assert(stepped !== undefined, "the stepped skimmer must survive one tick");
      assert(stepped.x > 500, "a skimmer with heading 1 must move in the positive x direction");
      // targetY at ageSeconds=0, phase=0 is 106 + sin(0) * 28 = 106, well below the fixture's
      // starting y of 200 -- one small tick must move partway toward it, not snap to it.
      assert(
        stepped.y < 200 && stepped.y > 106,
        `expected the skimmer to move partway toward its sinusoidal target (106), got y=${stepped.y}`,
      );
    },
  },
  {
    name: "TC-001 the snatcher's capture gate only starts an abduction once it has actually reached the target",
    run: () => {
      const x = 500;
      const target = ground(1, x);
      const captureY = starDefenderTerrainY(x) - 14;

      // "Inside": place the snatcher exactly at the capture point already, so a small tick
      // leaves it within SNATCHER_CAPTURE_RADIUS regardless of movement rate.
      const arrived = enemy("snatcher", x, captureY);
      const arrivedEvents: StarDefenderSimulationEvent[] = [];
      const arrivedInhabitants = [ground(1, x)];
      const arrivedResult = updateStarDefenderEnemies(
        [arrived],
        arrivedInhabitants,
        player(0, 0),
        "frontier",
        1 / 60,
        arrivedEvents,
      );
      assert(
        arrivedEvents.some((event) => event.type === "abduction-started"),
        "a snatcher already at the capture point must start an abduction",
      );
      assert(
        arrivedInhabitants[0]?.state === "abducted" &&
          arrivedResult[0]?.carryingInhabitantId === target.id,
        "the targeted inhabitant and enemy must both reflect the started abduction",
      );

      // "Far": place the snatcher far away with a tiny tick, so it only closes a small fraction
      // of the gap and remains well outside the capture radius.
      const far = enemy("snatcher", x + 200, captureY - 200);
      const farEvents: StarDefenderSimulationEvent[] = [];
      const farInhabitants = [ground(1, x)];
      updateStarDefenderEnemies(
        [far],
        farInhabitants,
        player(0, 0),
        "frontier",
        1 / 600,
        farEvents,
      );
      assert(
        farEvents.every((event) => event.type !== "abduction-started"),
        "a snatcher far from its target must not start an abduction on the same tick",
      );
      assert(
        farInhabitants[0]?.state === "ground",
        "the far target must remain grounded until the snatcher actually arrives",
      );
    },
  },
  {
    name: "TC-001 a snatcher targets the nearest grounded inhabitant by wrapped, not naive, distance",
    run: () => {
      // From x=10: candidate A at x=1000 is 990 away by naive distance. Candidate B at x=2040 is
      // 2030 away naively, but only 18 away by the wrapped (short way around the seam) distance --
      // the true nearest target if wrap-aware distance is actually used for comparison.
      const near = enemy("snatcher", 10, 100);
      const inhabitants = [ground(1, 1000), ground(2, wrapStarDefenderWorldX(2040))];
      const result = updateStarDefenderEnemies(
        [near],
        inhabitants,
        player(0, 0),
        "frontier",
        1 / 600,
        [],
      );
      assert(
        result[0]?.targetInhabitantId === 2,
        `expected the wrap-nearest inhabitant (id 2) to be targeted, got ${String(result[0]?.targetInhabitantId)}`,
      );
    },
  },
  {
    name: "TC-001 a carried inhabitant lost by altitude alone is dropped without destroying its carrier",
    run: () => {
      // Distinct from simulation.test.ts's P15-007/P15-008 case, which drops a carried
      // inhabitant by destroying the carrying enemy (the emergency burst). This drops it purely
      // by the snatcher's own ascent reaching playfieldTop -- the enemy survives.
      //
      // The starting altitude and dtSeconds (1s) are chosen so the ascent
      // (SNATCHER_SPEED * 0.72 * abductionScale * dt = 45 * 0.72 * 1 * 1 = 32.4) lands the
      // resulting y at exactly playfieldTop -- inside the documented "playfieldTop + 2" trigger
      // band but not so far past it that a tighter (or looser) threshold would go unnoticed.
      const carrier = enemy("snatcher", 500, STAR_DEFENDER_RUN_RULES.playfieldTop + 32.4, {
        carryingInhabitantId: 9,
        targetInhabitantId: 9,
      });
      const carried: StarDefenderInhabitant = Object.freeze({
        id: 9,
        x: 500,
        y: STAR_DEFENDER_RUN_RULES.playfieldTop + 11,
        state: "abducted",
        carrierEnemyId: carrier.id,
        velocityY: 0,
      });
      const inhabitants = [carried];
      const events: StarDefenderSimulationEvent[] = [];

      const result = updateStarDefenderEnemies(
        [carrier],
        inhabitants,
        player(0, 0),
        "frontier",
        1,
        events,
      );

      assert(
        events.some((event) => event.type === "inhabitant-lost" && event.inhabitantId === 9),
        "reaching playfieldTop while carried must emit inhabitant-lost",
      );
      assert(
        inhabitants[0]?.state === "lost" &&
          inhabitants[0].y === STAR_DEFENDER_RUN_RULES.playfieldTop,
        "the lost inhabitant must land exactly at playfieldTop",
      );
      const steppedCarrier = result[0];
      assert(
        steppedCarrier !== undefined &&
          steppedCarrier.carryingInhabitantId === null &&
          steppedCarrier.targetInhabitantId === null,
        "the carrier must clear both its carrying and target ids once its cargo is lost",
      );
      assert(
        steppedCarrier.y === STAR_DEFENDER_RUN_RULES.playfieldTop + 8,
        "the carrier itself must survive, settling at playfieldTop + 8",
      );
    },
  },
  {
    name: "TC-001 a snatcher with no grounded inhabitants left roams instead of pursuing or idling",
    run: () => {
      const roaming = enemy("snatcher", 500, 50, { targetInhabitantId: 3 });
      const noneGrounded: StarDefenderInhabitant[] = [
        Object.freeze({
          id: 3,
          x: 500,
          y: 50,
          state: "lost",
          carrierEnemyId: null,
          velocityY: 0,
        }),
      ];
      const result = updateStarDefenderEnemies(
        [roaming],
        noneGrounded,
        player(0, 0),
        "frontier",
        1 / 60,
        [],
      );
      const stepped = result[0];
      assert(stepped !== undefined, "the roaming snatcher must survive one tick");
      assert(
        stepped.targetInhabitantId === null,
        "a snatcher with nothing grounded left to target must clear its stale target id",
      );
      assert(
        stepped.y > 50 && stepped.y < 92,
        "a roaming snatcher must move toward the documented 92 roam altitude, not idle or snap to it",
      );
    },
  },
];
