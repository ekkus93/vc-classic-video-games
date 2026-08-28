import { BARREL_CLIMBER_RUN_RULES } from "./design.js";
import {
  barrelClimberPlatformById,
  type BarrelClimberStage,
} from "./stages.js";

export type BarrelClimberPlayerMode = "grounded" | "airborne" | "climbing";

export interface BarrelClimberPlayerState {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly facing: -1 | 1;
  readonly mode: BarrelClimberPlayerMode;
  readonly platformId: string | null;
  readonly ladderId: string | null;
}

export interface BarrelClimberPlayerInput {
  readonly move: -1 | 0 | 1;
  readonly climb: -1 | 0 | 1;
  readonly jump: boolean;
}

export interface BarrelClimberPlayerStep {
  readonly state: BarrelClimberPlayerState;
  readonly jumped: boolean;
  readonly landed: boolean;
  readonly mountedLadder: boolean;
  readonly dismountedLadder: boolean;
}

const HALF_WIDTH = BARREL_CLIMBER_RUN_RULES.playerWidth / 2;
const LADDER_MOUNT_TOLERANCE = 8;

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export function createBarrelClimberPlayer(stage: BarrelClimberStage): BarrelClimberPlayerState {
  const platform = barrelClimberPlatformById(stage, stage.playerSpawn.platformId);
  return Object.freeze({
    x: stage.playerSpawn.x,
    y: platform.y,
    velocityX: 0,
    velocityY: 0,
    facing: 1,
    mode: "grounded",
    platformId: platform.id,
    ladderId: null,
  });
}

function mountedLadder(
  stage: BarrelClimberStage,
  state: BarrelClimberPlayerState,
  climb: -1 | 0 | 1,
) {
  if (state.platformId === null || climb === 0) {
    return undefined;
  }
  return stage.ladders.find((ladder) => {
    if (Math.abs(state.x - ladder.x) > LADDER_MOUNT_TOLERANCE) {
      return false;
    }
    return climb < 0
      ? ladder.bottomPlatformId === state.platformId
      : ladder.topPlatformId === state.platformId;
  });
}

export function stepBarrelClimberPlayer(
  stage: BarrelClimberStage,
  state: BarrelClimberPlayerState,
  input: BarrelClimberPlayerInput,
  dtSeconds: number,
): BarrelClimberPlayerStep {
  requireDelta(dtSeconds);
  const facing: -1 | 1 = input.move === 0 ? state.facing : input.move;

  if (state.mode === "climbing") {
    const ladder = stage.ladders.find((candidate) => candidate.id === state.ladderId);
    if (ladder === undefined) {
      throw new Error(`Unknown active Barrel Climber ladder: ${String(state.ladderId)}`);
    }
    const nextY = Math.max(
      ladder.yTop,
      Math.min(
        ladder.yBottom,
        state.y + input.climb * BARREL_CLIMBER_RUN_RULES.climbSpeed * dtSeconds,
      ),
    );
    if (nextY <= ladder.yTop) {
      return Object.freeze({
        state: Object.freeze({
          x: ladder.x,
          y: ladder.yTop,
          velocityX: 0,
          velocityY: 0,
          facing,
          mode: "grounded" as const,
          platformId: ladder.topPlatformId,
          ladderId: null,
        }),
        jumped: false,
        landed: false,
        mountedLadder: false,
        dismountedLadder: true,
      });
    }
    if (nextY >= ladder.yBottom) {
      return Object.freeze({
        state: Object.freeze({
          x: ladder.x,
          y: ladder.yBottom,
          velocityX: 0,
          velocityY: 0,
          facing,
          mode: "grounded" as const,
          platformId: ladder.bottomPlatformId,
          ladderId: null,
        }),
        jumped: false,
        landed: false,
        mountedLadder: false,
        dismountedLadder: true,
      });
    }
    return Object.freeze({
      state: Object.freeze({
        ...state,
        x: ladder.x,
        y: nextY,
        velocityX: 0,
        velocityY: 0,
        facing,
      }),
      jumped: false,
      landed: false,
      mountedLadder: false,
      dismountedLadder: false,
    });
  }

  if (state.mode === "grounded") {
    if (state.platformId === null) {
      throw new Error("Grounded Barrel Climber player must own a platform");
    }
    const ladder = mountedLadder(stage, state, input.climb);
    if (ladder !== undefined) {
      const y = input.climb < 0 ? ladder.yBottom - 0.01 : ladder.yTop + 0.01;
      return Object.freeze({
        state: Object.freeze({
          x: ladder.x,
          y,
          velocityX: 0,
          velocityY: 0,
          facing,
          mode: "climbing" as const,
          platformId: null,
          ladderId: ladder.id,
        }),
        jumped: false,
        landed: false,
        mountedLadder: true,
        dismountedLadder: false,
      });
    }

    const platform = barrelClimberPlatformById(stage, state.platformId);
    const x = Math.max(
      platform.x1 + HALF_WIDTH,
      Math.min(
        platform.x2 - HALF_WIDTH,
        state.x + input.move * BARREL_CLIMBER_RUN_RULES.runSpeed * dtSeconds,
      ),
    );
    if (input.jump) {
      return Object.freeze({
        state: Object.freeze({
          x,
          y: state.y,
          velocityX: input.move * BARREL_CLIMBER_RUN_RULES.runSpeed,
          velocityY: BARREL_CLIMBER_RUN_RULES.jumpVelocity,
          facing,
          mode: "airborne" as const,
          platformId: state.platformId,
          ladderId: null,
        }),
        jumped: true,
        landed: false,
        mountedLadder: false,
        dismountedLadder: false,
      });
    }
    return Object.freeze({
      state: Object.freeze({
        ...state,
        x,
        velocityX: 0,
        velocityY: 0,
        facing,
      }),
      jumped: false,
      landed: false,
      mountedLadder: false,
      dismountedLadder: false,
    });
  }

  const velocityX = input.move * BARREL_CLIMBER_RUN_RULES.runSpeed;
  const velocityY = state.velocityY + BARREL_CLIMBER_RUN_RULES.gravity * dtSeconds;
  const previousY = state.y;
  const x = Math.max(
    HALF_WIDTH,
    Math.min(BARREL_CLIMBER_RUN_RULES.logicalWidth - HALF_WIDTH, state.x + velocityX * dtSeconds),
  );
  const y = state.y + velocityY * dtSeconds;

  if (velocityY >= 0 && state.platformId !== null) {
    const platform = barrelClimberPlatformById(stage, state.platformId);
    if (
      previousY <= platform.y &&
      y >= platform.y &&
      x >= platform.x1 + HALF_WIDTH &&
      x <= platform.x2 - HALF_WIDTH
    ) {
      return Object.freeze({
        state: Object.freeze({
          x,
          y: platform.y,
          velocityX: 0,
          velocityY: 0,
          facing,
          mode: "grounded" as const,
          platformId: platform.id,
          ladderId: null,
        }),
        jumped: false,
        landed: true,
        mountedLadder: false,
        dismountedLadder: false,
      });
    }
  }

  return Object.freeze({
    state: Object.freeze({
      ...state,
      x,
      y,
      velocityX,
      velocityY,
      facing,
    }),
    jumped: false,
    landed: false,
    mountedLadder: false,
    dismountedLadder: false,
  });
}
