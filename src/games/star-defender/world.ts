import type { Vector2 } from "../../engine/index.js";
import {
  STAR_DEFENDER_PLAYER_RULES,
  STAR_DEFENDER_RUN_RULES,
} from "./design.js";

const TAU = Math.PI * 2;

export function wrapStarDefenderWorldX(x: number): number {
  if (!Number.isFinite(x)) {
    throw new RangeError("world x must be finite");
  }
  const width = STAR_DEFENDER_RUN_RULES.worldWidth;
  return ((x % width) + width) % width;
}

export function wrappedStarDefenderDeltaX(fromX: number, toX: number): number {
  const width = STAR_DEFENDER_RUN_RULES.worldWidth;
  let delta = wrapStarDefenderWorldX(toX) - wrapStarDefenderWorldX(fromX);
  if (delta >= width / 2) {
    delta -= width;
  } else if (delta < -width / 2) {
    delta += width;
  }
  return delta;
}

export function wrappedStarDefenderDistanceSquared(
  first: Vector2,
  second: Vector2,
): number {
  const dx = wrappedStarDefenderDeltaX(first.x, second.x);
  const dy = second.y - first.y;
  return dx * dx + dy * dy;
}

export function starDefenderTerrainY(x: number): number {
  const normalized = wrapStarDefenderWorldX(x) / STAR_DEFENDER_RUN_RULES.worldWidth;
  return (
    198 +
    Math.sin(normalized * TAU * 3) * 8 +
    Math.sin(normalized * TAU * 7 + 0.73) * 4 +
    Math.sin(normalized * TAU * 11 + 1.91) * 2
  );
}

export function starDefenderCameraCenterX(
  playerX: number,
  facing: -1 | 1,
): number {
  return wrapStarDefenderWorldX(
    playerX + facing * STAR_DEFENDER_PLAYER_RULES.cameraLookAhead,
  );
}

export function starDefenderWorldToScreenX(
  worldX: number,
  cameraCenterX: number,
): number {
  return (
    STAR_DEFENDER_RUN_RULES.logicalWidth / 2 +
    wrappedStarDefenderDeltaX(cameraCenterX, worldX)
  );
}

export function starDefenderScreenToWorldX(
  screenX: number,
  cameraCenterX: number,
): number {
  return wrapStarDefenderWorldX(
    cameraCenterX + screenX - STAR_DEFENDER_RUN_RULES.logicalWidth / 2,
  );
}

export function starDefenderRadarX(
  worldX: number,
  left: number,
  width: number,
): number {
  if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
    throw new RangeError("radar bounds must be finite and width must be positive");
  }
  return left + (wrapStarDefenderWorldX(worldX) / STAR_DEFENDER_RUN_RULES.worldWidth) * width;
}
