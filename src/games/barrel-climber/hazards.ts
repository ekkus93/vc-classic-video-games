import type { RandomService } from "../../engine/index.js";
import { BARREL_CLIMBER_RUN_RULES } from "./design.js";
import {
  barrelClimberPlatformById,
  type BarrelClimberStage,
} from "./stages.js";

export type BarrelClimberHazardMode = "rolling" | "falling" | "descending";

export interface BarrelClimberHazard {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly direction: -1 | 1;
  readonly mode: BarrelClimberHazardMode;
  readonly platformId: string | null;
  readonly ladderId: string | null;
  readonly verticalSpeed: number;
  readonly rotationRadians: number;
}

export interface BarrelClimberHazardStepOptions {
  readonly speedScale: number;
  readonly ladderDropScale: number;
  readonly rng: RandomService;
}

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export function createBarrelClimberHazard(
  stage: BarrelClimberStage,
  id: number,
): BarrelClimberHazard {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new RangeError("hazard id must be a positive safe integer");
  }
  const platform = barrelClimberPlatformById(stage, stage.hazardSpawn.platformId);
  return Object.freeze({
    id,
    x: stage.hazardSpawn.x,
    y: platform.y - BARREL_CLIMBER_RUN_RULES.hazardRadius,
    direction: stage.hazardSpawn.direction,
    mode: "rolling",
    platformId: platform.id,
    ladderId: null,
    verticalSpeed: 0,
    rotationRadians: 0,
  });
}

function crossedX(oldX: number, nextX: number, targetX: number, direction: -1 | 1): boolean {
  return direction > 0
    ? oldX < targetX && nextX >= targetX
    : oldX > targetX && nextX <= targetX;
}

function stepRollingHazard(
  stage: BarrelClimberStage,
  hazard: BarrelClimberHazard,
  dtSeconds: number,
  options: BarrelClimberHazardStepOptions,
): BarrelClimberHazard {
  if (hazard.platformId === null) {
    throw new Error("Rolling Barrel Climber hazard must own a platform");
  }
  const platform = barrelClimberPlatformById(stage, hazard.platformId);
  const speed = BARREL_CLIMBER_RUN_RULES.hazardBaseSpeed * options.speedScale;
  const nextX = hazard.x + hazard.direction * speed * dtSeconds;
  const radius = BARREL_CLIMBER_RUN_RULES.hazardRadius;

  const crossedLadder = stage.ladders.find(
    (ladder) =>
      ladder.topPlatformId === platform.id &&
      ladder.hazardDropChance > 0 &&
      crossedX(hazard.x, nextX, ladder.x, hazard.direction),
  );
  if (crossedLadder !== undefined) {
    const chance = Math.min(1, crossedLadder.hazardDropChance * options.ladderDropScale);
    if (options.rng.nextFloat() < chance) {
      return Object.freeze({
        ...hazard,
        x: crossedLadder.x,
        direction: hazard.direction,
        mode: "descending" as const,
        platformId: null,
        ladderId: crossedLadder.id,
        verticalSpeed: 0,
        rotationRadians: hazard.rotationRadians + hazard.direction * dtSeconds * 5,
      });
    }
  }

  if (nextX < platform.x1 + radius || nextX > platform.x2 - radius) {
    const edgeX = nextX < platform.x1 + radius ? platform.x1 + radius : platform.x2 - radius;
    return Object.freeze({
      ...hazard,
      x: edgeX,
      mode: "falling" as const,
      platformId: null,
      ladderId: null,
      verticalSpeed: 0,
      rotationRadians: hazard.rotationRadians + hazard.direction * dtSeconds * 5,
    });
  }

  return Object.freeze({
    ...hazard,
    x: nextX,
    y: platform.y - radius,
    rotationRadians: hazard.rotationRadians + hazard.direction * dtSeconds * 5,
  });
}

function stepDescendingHazard(
  stage: BarrelClimberStage,
  hazard: BarrelClimberHazard,
  dtSeconds: number,
): BarrelClimberHazard {
  const ladder = stage.ladders.find((candidate) => candidate.id === hazard.ladderId);
  if (ladder === undefined) {
    throw new Error(`Unknown descending Barrel Climber ladder: ${String(hazard.ladderId)}`);
  }
  const targetY = ladder.yBottom - BARREL_CLIMBER_RUN_RULES.hazardRadius;
  const y = Math.min(targetY, hazard.y + BARREL_CLIMBER_RUN_RULES.hazardLadderSpeed * dtSeconds);
  if (y >= targetY) {
    const platform = barrelClimberPlatformById(stage, ladder.bottomPlatformId);
    return Object.freeze({
      ...hazard,
      x: ladder.x,
      y: targetY,
      direction: platform.hazardDirection,
      mode: "rolling" as const,
      platformId: platform.id,
      ladderId: null,
      verticalSpeed: 0,
      rotationRadians: hazard.rotationRadians + dtSeconds * 3,
    });
  }
  return Object.freeze({
    ...hazard,
    x: ladder.x,
    y,
    rotationRadians: hazard.rotationRadians + dtSeconds * 3,
  });
}

function stepFallingHazard(
  stage: BarrelClimberStage,
  hazard: BarrelClimberHazard,
  dtSeconds: number,
): BarrelClimberHazard | null {
  const verticalSpeed = hazard.verticalSpeed + BARREL_CLIMBER_RUN_RULES.hazardFallAcceleration * dtSeconds;
  const nextY = hazard.y + verticalSpeed * dtSeconds;
  const radius = BARREL_CLIMBER_RUN_RULES.hazardRadius;
  const landing = stage.platforms
    .filter((platform) => hazard.x >= platform.x1 + radius && hazard.x <= platform.x2 - radius)
    .map((platform) => ({ platform, targetY: platform.y - radius }))
    .filter(({ targetY }) => targetY > hazard.y && targetY <= nextY)
    .sort((a, b) => a.targetY - b.targetY)[0];

  if (landing !== undefined) {
    return Object.freeze({
      ...hazard,
      y: landing.targetY,
      direction: landing.platform.hazardDirection,
      mode: "rolling" as const,
      platformId: landing.platform.id,
      ladderId: null,
      verticalSpeed: 0,
      rotationRadians: hazard.rotationRadians + hazard.direction * dtSeconds * 5,
    });
  }
  if (nextY - radius > BARREL_CLIMBER_RUN_RULES.logicalHeight + 16) {
    return null;
  }
  return Object.freeze({
    ...hazard,
    y: nextY,
    verticalSpeed,
    rotationRadians: hazard.rotationRadians + hazard.direction * dtSeconds * 5,
  });
}

export function stepBarrelClimberHazard(
  stage: BarrelClimberStage,
  hazard: BarrelClimberHazard,
  dtSeconds: number,
  options: BarrelClimberHazardStepOptions,
): BarrelClimberHazard | null {
  requireDelta(dtSeconds);
  if (!Number.isFinite(options.speedScale) || options.speedScale <= 0) {
    throw new RangeError("hazard speedScale must be positive and finite");
  }
  if (!Number.isFinite(options.ladderDropScale) || options.ladderDropScale < 0) {
    throw new RangeError("hazard ladderDropScale must be non-negative and finite");
  }
  switch (hazard.mode) {
    case "rolling":
      return stepRollingHazard(stage, hazard, dtSeconds, options);
    case "descending":
      return stepDescendingHazard(stage, hazard, dtSeconds);
    case "falling":
      return stepFallingHazard(stage, hazard, dtSeconds);
  }
}
