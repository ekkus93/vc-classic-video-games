import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_RUN_RULES, STAR_DEFENDER_SCORING } from "./design.js";
import {
  createInitialStarDefenderInhabitants,
  resolveStarDefenderFallingCatches,
  updateStarDefenderInhabitants,
  type StarDefenderInhabitant,
} from "./inhabitants.js";
import type { StarDefenderPlayerState } from "./player.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";
import { starDefenderTerrainY } from "./world.js";

function player(x: number, y: number): StarDefenderPlayerState {
  return Object.freeze({ x, y, velocityX: 0, velocityY: 0, facing: 1 });
}

function inhabitant(
  id: number,
  x: number,
  state: StarDefenderInhabitant["state"],
  overrides: Partial<StarDefenderInhabitant> = {},
): StarDefenderInhabitant {
  return Object.freeze({
    id,
    x,
    y: starDefenderTerrainY(x) - 3,
    state,
    carrierEnemyId: null,
    velocityY: 0,
    ...overrides,
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "TC-001 createInitialStarDefenderInhabitants places exactly inhabitantCount settlers, evenly spaced with bounded jitter",
    run: () => {
      const rng = new SeededRandomService(0x51);
      const result = createInitialStarDefenderInhabitants(rng);
      assert(
        result.length === STAR_DEFENDER_RUN_RULES.inhabitantCount,
        `expected exactly ${STAR_DEFENDER_RUN_RULES.inhabitantCount} inhabitants, got ${result.length}`,
      );
      const spacing =
        STAR_DEFENDER_RUN_RULES.worldWidth / STAR_DEFENDER_RUN_RULES.inhabitantCount;
      const maxJitter = spacing * 0.14;
      result.forEach((entry, index) => {
        const center = spacing * (index + 0.5);
        const distance = Math.abs(entry.x - center);
        assert(
          distance <= maxJitter + 1e-9,
          `inhabitant ${index} at x=${entry.x} must sit within ${maxJitter} of its slot center ${center}, was ${distance} away`,
        );
        assert(entry.state === "ground", `inhabitant ${index} must start grounded`);
      });
    },
  },
  {
    name: "TC-001 createInitialStarDefenderInhabitants is reproducible under a fixed seed",
    run: () => {
      const first = createInitialStarDefenderInhabitants(new SeededRandomService(0x51));
      const second = createInitialStarDefenderInhabitants(new SeededRandomService(0x51));
      assert(
        JSON.stringify(first) === JSON.stringify(second),
        "the same seed must produce byte-identical initial placement",
      );
    },
  },
  {
    name: "TC-001 a grounded inhabitant tracks the terrain under it every tick",
    run: () => {
      const x = 700;
      const ground = inhabitant(1, x, "ground", { y: 0 });
      const result = updateStarDefenderInhabitants([ground], player(0, 0), 1 / 60, []);
      assert(
        result.inhabitants[0]?.y === starDefenderTerrainY(x) - 3,
        "a grounded inhabitant's y must be recomputed from the terrain height under it",
      );
      assert(result.scoreDelta === 0, "terrain following alone must not award score");
    },
  },
  {
    name: "TC-001 an abducted inhabitant passes through untouched",
    run: () => {
      const abducted = inhabitant(1, 500, "abducted", { carrierEnemyId: 7 });
      const events: StarDefenderSimulationEvent[] = [];
      const result = updateStarDefenderInhabitants([abducted], player(0, 0), 1 / 60, events);
      assert(
        result.inhabitants[0] === abducted,
        "an abducted inhabitant must be returned unchanged (same reference) while carried",
      );
      assert(events.length === 0 && result.scoreDelta === 0, "no event or score while abducted");
    },
  },
  {
    name: "TC-001 a falling inhabitant accelerates under gravity and lands as lost on reaching the terrain",
    run: () => {
      const x = 500;
      const stillFalling = inhabitant(1, x, "falling", { y: starDefenderTerrainY(x) - 60 });
      const midAir = updateStarDefenderInhabitants([stillFalling], player(0, 0), 1 / 60, []);
      assert(
        midAir.inhabitants[0]?.state === "falling" &&
          (midAir.inhabitants[0].velocityY ?? 0) > 0,
        "a falling inhabitant well above the terrain must keep falling with increasing downward velocity",
      );

      // Chosen so the post-tick y lands at exactly terrainY(x) -- 3 device-pixel-equivalents
      // past the documented "terrainY(x) - 3" landing line, not dozens of units past it, so a
      // mutation that materially shifts the threshold (not just an off-by-a-fraction change) is
      // what this fixture is built to catch.
      const dt = 1 / 60;
      const FALL_GRAVITY = 58; // mirrors inhabitants.ts's own (unexported) constant
      const velocityYAtLanding = FALL_GRAVITY * dt;
      const aboutToLand = inhabitant(2, x, "falling", {
        y: starDefenderTerrainY(x) - velocityYAtLanding * dt,
        velocityY: 0,
      });
      const events: StarDefenderSimulationEvent[] = [];
      const landed = updateStarDefenderInhabitants([aboutToLand], player(0, 0), dt, events);
      assert(
        events.some((event) => event.type === "inhabitant-lost" && event.inhabitantId === 2),
        "reaching the terrain while falling must emit inhabitant-lost",
      );
      assert(
        landed.inhabitants[0]?.state === "lost" &&
          landed.inhabitants[0].y === starDefenderTerrainY(x) - 3 &&
          landed.inhabitants[0].velocityY === 0,
        "a landed inhabitant must settle exactly at the terrain line with velocity reset",
      );
    },
  },
  {
    name: "TC-001 a carried inhabitant tracks the player until the safe-return altitude, then returns to ground and scores",
    run: () => {
      const x = 500;
      const stillCarried = inhabitant(1, x, "carried", { carrierEnemyId: null });
      const highPlayer = player(x, starDefenderTerrainY(x) - 30);
      const midFlight = updateStarDefenderInhabitants([stillCarried], highPlayer, 1 / 60, []);
      assert(
        midFlight.inhabitants[0]?.state === "carried" &&
          midFlight.inhabitants[0].x === x &&
          midFlight.inhabitants[0].y === highPlayer.y + 10,
        "a carried inhabitant must track the player's position while above the return altitude",
      );
      assert(midFlight.scoreDelta === 0, "no score while still above the return threshold");

      const lowPlayer = player(x, starDefenderTerrainY(x) - 19);
      const events: StarDefenderSimulationEvent[] = [];
      const returned = updateStarDefenderInhabitants([stillCarried], lowPlayer, 1 / 60, events);
      assert(
        events.some(
          (event) =>
            event.type === "inhabitant-returned" &&
            event.inhabitantId === 1 &&
            event.points === STAR_DEFENDER_SCORING.safeReturn,
        ),
        "crossing the safe-return altitude must emit inhabitant-returned with the documented points",
      );
      assert(
        returned.scoreDelta === STAR_DEFENDER_SCORING.safeReturn,
        `scoreDelta must equal the safe-return points, got ${returned.scoreDelta}`,
      );
      assert(
        returned.inhabitants[0]?.state === "ground" &&
          returned.inhabitants[0].y === starDefenderTerrainY(x) - 3,
        "a returned inhabitant must land in the ground state at the terrain line",
      );
    },
  },
  {
    name: "TC-001 a lost inhabitant passes through untouched",
    run: () => {
      const lost = inhabitant(1, 500, "lost");
      const events: StarDefenderSimulationEvent[] = [];
      const result = updateStarDefenderInhabitants([lost], player(0, 0), 1 / 60, events);
      assert(result.inhabitants[0] === lost, "a lost inhabitant must be returned unchanged");
      assert(events.length === 0 && result.scoreDelta === 0, "no event or score once lost");
    },
  },
  {
    name: "TC-001 scoreDelta sums correctly when two carried inhabitants return in the same tick",
    run: () => {
      const xA = 300;
      const xB = 900;
      // Both fixtures share one dtSeconds/events call; each inhabitant's own x determines the
      // player-relative return check independently (`playerState.y >= terrainY(x) - 19`; larger
      // y is closer to the terrain). Using the *larger* of the two terrain heights for the
      // threshold guarantees the shared player position clears both inhabitants' individual
      // thresholds, since a larger terrain height produces a larger (harder to reach) threshold.
      const returnY = Math.max(starDefenderTerrainY(xA), starDefenderTerrainY(xB)) - 19;
      const sharedPlayer = player(0, returnY);
      const carriedA = inhabitant(1, xA, "carried");
      const carriedB = inhabitant(2, xB, "carried");
      const events: StarDefenderSimulationEvent[] = [];

      const result = updateStarDefenderInhabitants(
        [carriedA, carriedB],
        sharedPlayer,
        1 / 60,
        events,
      );

      const returnedEvents = events.filter((event) => event.type === "inhabitant-returned");
      assert(
        returnedEvents.length === 2,
        `expected both carried inhabitants to return in the same tick, got ${returnedEvents.length} return events`,
      );
      assert(
        result.scoreDelta === STAR_DEFENDER_SCORING.safeReturn * 2,
        `scoreDelta must sum both returns (${STAR_DEFENDER_SCORING.safeReturn * 2}), got ${result.scoreDelta}`,
      );
    },
  },
  {
    name: "TC-001 resolveStarDefenderFallingCatches only catches a falling inhabitant within the rescue radius",
    run: () => {
      const closePlayer = player(500, 100);
      const nearFalling = inhabitant(1, 500, "falling", { y: 105, velocityY: 20 });
      const caughtEvents: StarDefenderSimulationEvent[] = [];
      const caught = resolveStarDefenderFallingCatches(
        [nearFalling],
        closePlayer,
        caughtEvents,
      );
      assert(
        caughtEvents.some(
          (event) =>
            event.type === "inhabitant-caught" &&
            event.inhabitantId === 1 &&
            event.points === STAR_DEFENDER_SCORING.fallingCatch,
        ),
        "a falling inhabitant within the rescue radius must be caught",
      );
      assert(
        caught.inhabitants[0]?.state === "carried" &&
          caught.scoreDelta === STAR_DEFENDER_SCORING.fallingCatch,
        "a caught inhabitant must become carried and award the documented points",
      );

      const farFalling = inhabitant(2, 500, "falling", { y: 100 - 200, velocityY: 20 });
      const missedEvents: StarDefenderSimulationEvent[] = [];
      const missed = resolveStarDefenderFallingCatches([farFalling], closePlayer, missedEvents);
      assert(
        missedEvents.length === 0 && missed.scoreDelta === 0,
        "a falling inhabitant far outside the rescue radius must not be caught",
      );
      assert(
        missed.inhabitants[0]?.state === "falling",
        "an uncaught falling inhabitant must remain falling",
      );
    },
  },
  {
    name: "TC-001 resolveStarDefenderFallingCatches ignores inhabitants in any state other than falling",
    run: () => {
      // Positioned exactly where the player is, well within the rescue radius -- the radius check
      // alone would match, so only the state guard can be responsible for leaving it untouched.
      const grounded = inhabitant(1, 500, "ground", { y: 100 });
      const closePlayer = player(500, 100);
      const events: StarDefenderSimulationEvent[] = [];
      const result = resolveStarDefenderFallingCatches([grounded], closePlayer, events);
      assert(events.length === 0, "a non-falling inhabitant must never be caught, regardless of distance");
      assert(
        result.inhabitants[0] === grounded,
        "a non-falling inhabitant must be returned unchanged",
      );
    },
  },
];
