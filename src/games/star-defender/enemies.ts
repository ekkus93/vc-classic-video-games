import type { RandomService } from "../../engine/index.js";
import {
  STAR_DEFENDER_DIFFICULTIES,
  STAR_DEFENDER_RUN_RULES,
  starDefenderWaveEnemyCount,
  type StarDefenderDifficultyId,
} from "./design.js";
import type { StarDefenderInhabitant } from "./inhabitants.js";
import type { StarDefenderPlayerState } from "./player.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";
import {
  starDefenderTerrainY,
  wrapStarDefenderWorldX,
  wrappedStarDefenderDeltaX,
  wrappedStarDefenderDistanceSquared,
} from "./world.js";

export type StarDefenderEnemyType = "snatcher" | "stalker" | "skimmer";

export interface StarDefenderEnemy {
  readonly id: number;
  readonly type: StarDefenderEnemyType;
  readonly x: number;
  readonly y: number;
  readonly heading: -1 | 1;
  readonly phase: number;
  readonly ageSeconds: number;
  readonly targetInhabitantId: number | null;
  readonly carryingInhabitantId: number | null;
}

/** A freshly generated wave, plus the next unused enemy id for the caller to keep tracking. */
export interface StarDefenderWave {
  readonly enemies: readonly StarDefenderEnemy[];
  readonly nextEnemyId: number;
}

const SNATCHER_SPEED = 45;
const STALKER_SPEED = 58;
const SKIMMER_SPEED = 64;
const SNATCHER_CAPTURE_RADIUS = 9;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function moveToward(current: number, target: number, maximumDelta: number): number {
  if (current < target) {
    return Math.min(target, current + maximumDelta);
  }
  return Math.max(target, current - maximumDelta);
}

/** Seeded procedural generation for one wave's enemy population. */
export function createStarDefenderWave(
  rng: RandomService,
  difficulty: StarDefenderDifficultyId,
  wave: number,
  startId: number,
): StarDefenderWave {
  const count = starDefenderWaveEnemyCount(wave, difficulty);
  const result: StarDefenderEnemy[] = [];
  let nextId = startId;
  for (let index = 0; index < count; index += 1) {
    const selector = (index + wave) % 6;
    const type: StarDefenderEnemyType =
      selector < 3 ? "snatcher" : selector < 5 ? "stalker" : "skimmer";
    const x = rng.nextFloat() * STAR_DEFENDER_RUN_RULES.worldWidth;
    const y = 64 + rng.nextFloat() * 92;
    const heading: -1 | 1 = rng.nextFloat() < 0.5 ? -1 : 1;
    result.push(
      Object.freeze({
        id: nextId,
        type,
        x,
        y,
        heading,
        phase: rng.nextFloat() * Math.PI * 2,
        ageSeconds: 0,
        targetInhabitantId: null,
        carryingInhabitantId: null,
      }),
    );
    nextId += 1;
  }
  return { enemies: Object.freeze(result), nextEnemyId: nextId };
}

/**
 * Steps every enemy one frame. `inhabitants` is mutated in place -- a snatcher abducting or
 * losing its cargo transitions the affected inhabitant's state as a side effect of stepping the
 * enemy, exactly as the pre-split code on `StarDefenderSimulation` did, so the caller passes a
 * mutable working copy (`[...this.inhabitantState]`) and re-freezes it afterward.
 */
export function updateStarDefenderEnemies(
  enemies: readonly StarDefenderEnemy[],
  inhabitants: StarDefenderInhabitant[],
  playerState: StarDefenderPlayerState,
  difficulty: StarDefenderDifficultyId,
  dtSeconds: number,
  events: StarDefenderSimulationEvent[],
): readonly StarDefenderEnemy[] {
  const speedScale = STAR_DEFENDER_DIFFICULTIES[difficulty].enemySpeedScale;
  const next = enemies.map((enemy) => {
    const ageSeconds = enemy.ageSeconds + dtSeconds;
    switch (enemy.type) {
      case "snatcher":
        return updateSnatcher(
          { ...enemy, ageSeconds },
          inhabitants,
          difficulty,
          speedScale,
          dtSeconds,
          events,
        );
      case "stalker": {
        const dx = wrappedStarDefenderDeltaX(enemy.x, playerState.x);
        const heading: -1 | 1 = dx < 0 ? -1 : 1;
        const x = wrapStarDefenderWorldX(
          enemy.x + heading * STALKER_SPEED * speedScale * dtSeconds,
        );
        const y = moveToward(
          enemy.y,
          playerState.y,
          STALKER_SPEED * 0.72 * speedScale * dtSeconds,
        );
        return Object.freeze({ ...enemy, x, y, heading, ageSeconds });
      }
      case "skimmer": {
        const x = wrapStarDefenderWorldX(
          enemy.x + enemy.heading * SKIMMER_SPEED * speedScale * dtSeconds,
        );
        const targetY = 106 + Math.sin(ageSeconds * 1.75 + enemy.phase) * 28;
        const y = moveToward(enemy.y, targetY, 46 * speedScale * dtSeconds);
        return Object.freeze({ ...enemy, x, y, ageSeconds });
      }
    }
  });
  return Object.freeze(next);
}

function updateSnatcher(
  enemy: StarDefenderEnemy,
  inhabitants: StarDefenderInhabitant[],
  difficulty: StarDefenderDifficultyId,
  speedScale: number,
  dtSeconds: number,
  events: StarDefenderSimulationEvent[],
): StarDefenderEnemy {
  const abductionScale = STAR_DEFENDER_DIFFICULTIES[difficulty].abductionSpeedScale;
  const carryingId = enemy.carryingInhabitantId;
  if (carryingId !== null) {
    const inhabitantIndex = inhabitants.findIndex((entry) => entry.id === carryingId);
    const inhabitant = inhabitants[inhabitantIndex];
    const y = enemy.y - SNATCHER_SPEED * 0.72 * abductionScale * dtSeconds;
    const x = wrapStarDefenderWorldX(
      enemy.x + enemy.heading * SNATCHER_SPEED * 0.13 * speedScale * dtSeconds,
    );
    if (inhabitant !== undefined) {
      if (y <= STAR_DEFENDER_RUN_RULES.playfieldTop + 2) {
        inhabitants[inhabitantIndex] = Object.freeze({
          ...inhabitant,
          x,
          y: STAR_DEFENDER_RUN_RULES.playfieldTop,
          state: "lost",
          carrierEnemyId: null,
          velocityY: 0,
        });
        events.push(
          Object.freeze({ type: "inhabitant-lost", inhabitantId: inhabitant.id }),
        );
        return Object.freeze({
          ...enemy,
          x,
          y: STAR_DEFENDER_RUN_RULES.playfieldTop + 8,
          carryingInhabitantId: null,
          targetInhabitantId: null,
        });
      }
      inhabitants[inhabitantIndex] = Object.freeze({
        ...inhabitant,
        x,
        y: y + 9,
        state: "abducted",
        carrierEnemyId: enemy.id,
        velocityY: 0,
      });
    }
    return Object.freeze({ ...enemy, x, y });
  }

  const ground = inhabitants.filter((entry) => entry.state === "ground");
  if (ground.length === 0) {
    const x = wrapStarDefenderWorldX(
      enemy.x + enemy.heading * SNATCHER_SPEED * 0.7 * speedScale * dtSeconds,
    );
    const y = moveToward(enemy.y, 92, 32 * speedScale * dtSeconds);
    return Object.freeze({
      ...enemy,
      x,
      y,
      targetInhabitantId: null,
    });
  }

  let target = ground[0];
  if (target === undefined) {
    return Object.freeze(enemy);
  }
  let closest = Math.abs(wrappedStarDefenderDeltaX(enemy.x, target.x));
  for (const candidate of ground.slice(1)) {
    const distance = Math.abs(wrappedStarDefenderDeltaX(enemy.x, candidate.x));
    if (distance < closest) {
      target = candidate;
      closest = distance;
    }
  }

  const dx = wrappedStarDefenderDeltaX(enemy.x, target.x);
  const heading: -1 | 1 = dx < 0 ? -1 : 1;
  const maximumHorizontal = SNATCHER_SPEED * speedScale * dtSeconds;
  const x = wrapStarDefenderWorldX(
    enemy.x + clamp(dx, -maximumHorizontal, maximumHorizontal),
  );
  const captureY = starDefenderTerrainY(target.x) - 14;
  const y = moveToward(
    enemy.y,
    captureY,
    SNATCHER_SPEED * 0.8 * speedScale * dtSeconds,
  );
  const closeEnough =
    wrappedStarDefenderDistanceSquared(
      { x, y },
      { x: target.x, y: captureY },
    ) <=
    SNATCHER_CAPTURE_RADIUS * SNATCHER_CAPTURE_RADIUS;

  if (closeEnough) {
    const targetIndex = inhabitants.findIndex((entry) => entry.id === target.id);
    const current = inhabitants[targetIndex];
    if (current !== undefined && current.state === "ground") {
      inhabitants[targetIndex] = Object.freeze({
        ...current,
        x,
        y: y + 9,
        state: "abducted",
        carrierEnemyId: enemy.id,
        velocityY: 0,
      });
      events.push(
        Object.freeze({
          type: "abduction-started",
          inhabitantId: current.id,
          enemyId: enemy.id,
        }),
      );
      return Object.freeze({
        ...enemy,
        x,
        y,
        heading,
        targetInhabitantId: current.id,
        carryingInhabitantId: current.id,
      });
    }
  }

  return Object.freeze({
    ...enemy,
    x,
    y,
    heading,
    targetInhabitantId: target.id,
  });
}
