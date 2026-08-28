import {
  STAR_DEFENDER_PLAYER_RULES,
  STAR_DEFENDER_RUN_RULES,
} from "./design.js";
import {
  starDefenderTerrainY,
  wrapStarDefenderWorldX,
} from "./world.js";

export interface StarDefenderPlayerState {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly facing: -1 | 1;
}

export interface StarDefenderPlayerInput {
  readonly horizontal: -1 | 0 | 1;
  readonly vertical: -1 | 0 | 1;
}

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function clampMagnitude(value: number, maximum: number): number {
  return Math.max(-maximum, Math.min(maximum, value));
}

function damp(value: number, rate: number, dtSeconds: number): number {
  return value * Math.exp(-rate * dtSeconds);
}

export function createStarDefenderPlayer(
  x = STAR_DEFENDER_RUN_RULES.worldWidth / 2,
): StarDefenderPlayerState {
  return Object.freeze({
    x: wrapStarDefenderWorldX(x),
    y: 118,
    velocityX: 0,
    velocityY: 0,
    facing: 1,
  });
}

export function stepStarDefenderPlayer(
  player: StarDefenderPlayerState,
  input: StarDefenderPlayerInput,
  dtSeconds: number,
): StarDefenderPlayerState {
  requireDelta(dtSeconds);

  let velocityX = damp(
    player.velocityX,
    STAR_DEFENDER_PLAYER_RULES.horizontalDragPerSecond,
    dtSeconds,
  );
  let velocityY = damp(
    player.velocityY,
    STAR_DEFENDER_PLAYER_RULES.verticalDragPerSecond,
    dtSeconds,
  );

  velocityX +=
    input.horizontal *
    STAR_DEFENDER_PLAYER_RULES.horizontalAcceleration *
    dtSeconds;
  velocityY +=
    input.vertical * STAR_DEFENDER_PLAYER_RULES.verticalAcceleration * dtSeconds;

  velocityX = clampMagnitude(
    velocityX,
    STAR_DEFENDER_PLAYER_RULES.maxHorizontalSpeed,
  );
  velocityY = clampMagnitude(
    velocityY,
    STAR_DEFENDER_PLAYER_RULES.maxVerticalSpeed,
  );

  const x = wrapStarDefenderWorldX(player.x + velocityX * dtSeconds);
  const minimumY = STAR_DEFENDER_RUN_RULES.playfieldTop + 9;
  const maximumY = starDefenderTerrainY(x) - 11;
  let y = player.y + velocityY * dtSeconds;
  if (y < minimumY) {
    y = minimumY;
    velocityY = Math.max(0, velocityY);
  }
  if (y > maximumY) {
    y = maximumY;
    velocityY = Math.min(0, velocityY);
  }

  return Object.freeze({
    x,
    y,
    velocityX,
    velocityY,
    facing: input.horizontal === 0 ? player.facing : input.horizontal,
  });
}
