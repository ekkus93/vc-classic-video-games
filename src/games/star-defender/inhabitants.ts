import type { RandomService } from "../../engine/index.js";
import { STAR_DEFENDER_RUN_RULES, STAR_DEFENDER_SCORING } from "./design.js";
import type { StarDefenderPlayerState } from "./player.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";
import {
  starDefenderTerrainY,
  wrapStarDefenderWorldX,
  wrappedStarDefenderDistanceSquared,
} from "./world.js";

export type StarDefenderInhabitantState =
  | "ground"
  | "abducted"
  | "falling"
  | "carried"
  | "lost";

export interface StarDefenderInhabitant {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly state: StarDefenderInhabitantState;
  readonly carrierEnemyId: number | null;
  readonly velocityY: number;
}

/** The result of stepping every inhabitant one frame: the new roster and any score it earned. */
export interface StarDefenderInhabitantStep {
  readonly inhabitants: readonly StarDefenderInhabitant[];
  readonly scoreDelta: number;
}

const FALL_GRAVITY = 58;
const RESCUE_CATCH_RADIUS =
  STAR_DEFENDER_RUN_RULES.playerRadius + STAR_DEFENDER_RUN_RULES.inhabitantRadius + 2;

export function createInitialStarDefenderInhabitants(
  rng: RandomService,
): readonly StarDefenderInhabitant[] {
  const result: StarDefenderInhabitant[] = [];
  const spacing = STAR_DEFENDER_RUN_RULES.worldWidth / STAR_DEFENDER_RUN_RULES.inhabitantCount;
  for (let index = 0; index < STAR_DEFENDER_RUN_RULES.inhabitantCount; index += 1) {
    const jitter = (rng.nextFloat() - 0.5) * spacing * 0.28;
    const x = wrapStarDefenderWorldX(spacing * (index + 0.5) + jitter);
    result.push(
      Object.freeze({
        id: index + 1,
        x,
        y: starDefenderTerrainY(x) - 3,
        state: "ground",
        carrierEnemyId: null,
        velocityY: 0,
      }),
    );
  }
  return Object.freeze(result);
}

export function updateStarDefenderInhabitants(
  inhabitants: readonly StarDefenderInhabitant[],
  playerState: StarDefenderPlayerState,
  dtSeconds: number,
  events: StarDefenderSimulationEvent[],
): StarDefenderInhabitantStep {
  let scoreDelta = 0;
  const next = inhabitants.map((inhabitant) => {
    switch (inhabitant.state) {
      case "ground":
        return Object.freeze({
          ...inhabitant,
          y: starDefenderTerrainY(inhabitant.x) - 3,
          velocityY: 0,
        });
      case "abducted":
        return inhabitant;
      case "falling": {
        const velocityY = inhabitant.velocityY + FALL_GRAVITY * dtSeconds;
        const y = inhabitant.y + velocityY * dtSeconds;
        if (y >= starDefenderTerrainY(inhabitant.x) - 3) {
          events.push(
            Object.freeze({ type: "inhabitant-lost", inhabitantId: inhabitant.id }),
          );
          return Object.freeze({
            ...inhabitant,
            y: starDefenderTerrainY(inhabitant.x) - 3,
            state: "lost",
            velocityY: 0,
          });
        }
        return Object.freeze({ ...inhabitant, y, velocityY });
      }
      case "carried": {
        const x = playerState.x;
        const y = playerState.y + 10;
        if (playerState.y >= starDefenderTerrainY(x) - 19) {
          const points = STAR_DEFENDER_SCORING.safeReturn;
          scoreDelta += points;
          events.push(
            Object.freeze({
              type: "inhabitant-returned",
              inhabitantId: inhabitant.id,
              points,
            }),
          );
          return Object.freeze({
            ...inhabitant,
            x,
            y: starDefenderTerrainY(x) - 3,
            state: "ground",
            carrierEnemyId: null,
            velocityY: 0,
          });
        }
        return Object.freeze({ ...inhabitant, x, y, velocityY: 0 });
      }
      case "lost":
        return inhabitant;
    }
  });
  return { inhabitants: Object.freeze(next), scoreDelta };
}

export function resolveStarDefenderFallingCatches(
  inhabitants: readonly StarDefenderInhabitant[],
  playerState: StarDefenderPlayerState,
  events: StarDefenderSimulationEvent[],
): StarDefenderInhabitantStep {
  let scoreDelta = 0;
  const next = inhabitants.map((inhabitant) => {
    if (
      inhabitant.state !== "falling" ||
      wrappedStarDefenderDistanceSquared(inhabitant, playerState) >
        RESCUE_CATCH_RADIUS * RESCUE_CATCH_RADIUS
    ) {
      return inhabitant;
    }
    const points = STAR_DEFENDER_SCORING.fallingCatch;
    scoreDelta += points;
    events.push(
      Object.freeze({
        type: "inhabitant-caught",
        inhabitantId: inhabitant.id,
        points,
      }),
    );
    return Object.freeze({
      ...inhabitant,
      x: playerState.x,
      y: playerState.y + 10,
      state: "carried",
      carrierEnemyId: null,
      velocityY: 0,
    });
  });
  return { inhabitants: Object.freeze(next), scoreDelta };
}
