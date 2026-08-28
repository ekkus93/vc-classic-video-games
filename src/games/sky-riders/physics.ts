import type { Vector2 } from "../../engine/index.js";
import { wrapCoordinate } from "../../engine/index.js";
import {
  SKY_RIDERS_PLATFORMS,
  SKY_RIDERS_RUN_RULES,
  type SkyRidersPlatform,
} from "./design.js";

export interface SkyRidersRiderState {
  readonly id: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly facing: -1 | 1;
  readonly grounded: boolean;
  readonly flapCooldownSeconds: number;
  readonly invulnerabilitySeconds: number;
}

export interface SkyRidersRiderInput {
  readonly horizontal: -1 | 0 | 1;
  readonly flap: boolean;
}

export interface SkyRidersRiderStepOptions {
  readonly maxHorizontalSpeed: number;
  readonly horizontalAccelerationScale?: number;
}

export interface SkyRidersRiderStepResult {
  readonly rider: SkyRidersRiderState;
  readonly flapped: boolean;
  readonly landedPlatformId: string | null;
}

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function horizontalOverlap(
  centerX: number,
  halfWidth: number,
  platform: SkyRidersPlatform,
): boolean {
  return (
    centerX + halfWidth >= platform.x &&
    centerX - halfWidth <= platform.x + platform.width
  );
}

function landingPlatform(
  previousPosition: Vector2,
  nextPosition: Vector2,
  nextVerticalVelocity: number,
  halfWidth: number,
  halfHeight: number,
  platforms: readonly SkyRidersPlatform[],
): SkyRidersPlatform | null {
  if (nextVerticalVelocity < 0) return null;
  const previousFeet = previousPosition.y + halfHeight;
  const nextFeet = nextPosition.y + halfHeight;
  let best: SkyRidersPlatform | null = null;
  for (const platform of platforms) {
    if (!horizontalOverlap(nextPosition.x, halfWidth, platform)) continue;
    if (previousFeet > platform.y + 0.001 || nextFeet < platform.y) continue;
    if (best === null || platform.y < best.y) best = platform;
  }
  return best;
}

export function createSkyRider(
  id: number,
  position: Vector2,
  facing: -1 | 1 = 1,
  invulnerabilitySeconds = 0,
): SkyRidersRiderState {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RangeError("rider id must be a positive safe integer");
  }
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(invulnerabilitySeconds) ||
    invulnerabilitySeconds < 0
  ) {
    throw new RangeError("rider position/protection must be finite and valid");
  }
  return Object.freeze({
    id,
    position: Object.freeze({ ...position }),
    velocity: Object.freeze({ x: 0, y: 0 }),
    facing,
    grounded: false,
    flapCooldownSeconds: 0,
    invulnerabilitySeconds,
  });
}

export function stepSkyRider(
  rider: SkyRidersRiderState,
  input: SkyRidersRiderInput,
  dtSeconds: number,
  options: SkyRidersRiderStepOptions,
  platforms: readonly SkyRidersPlatform[] = SKY_RIDERS_PLATFORMS,
): SkyRidersRiderStepResult {
  requireDelta(dtSeconds);
  if (!Number.isFinite(options.maxHorizontalSpeed) || options.maxHorizontalSpeed <= 0) {
    throw new RangeError("maxHorizontalSpeed must be positive and finite");
  }
  const accelerationScale = options.horizontalAccelerationScale ?? 1;
  if (!Number.isFinite(accelerationScale) || accelerationScale <= 0) {
    throw new RangeError("horizontalAccelerationScale must be positive and finite");
  }

  let horizontalVelocity = rider.velocity.x;
  if (input.horizontal !== 0) {
    horizontalVelocity +=
      input.horizontal *
      SKY_RIDERS_RUN_RULES.horizontalAcceleration *
      accelerationScale *
      dtSeconds;
  } else if (dtSeconds > 0) {
    horizontalVelocity *= Math.exp(-SKY_RIDERS_RUN_RULES.horizontalDragPerSecond * dtSeconds);
  }
  horizontalVelocity = clamp(
    horizontalVelocity,
    -options.maxHorizontalSpeed,
    options.maxHorizontalSpeed,
  );

  const cooldown = Math.max(0, rider.flapCooldownSeconds - dtSeconds);
  const flapped = input.flap && cooldown <= 0;
  let verticalVelocity = flapped
    ? -SKY_RIDERS_RUN_RULES.flapImpulse
    : rider.velocity.y + SKY_RIDERS_RUN_RULES.gravity * dtSeconds;
  verticalVelocity = Math.min(verticalVelocity, SKY_RIDERS_RUN_RULES.maxFallSpeed);

  const nextPosition = Object.freeze({
    x: wrapCoordinate(
      rider.position.x + horizontalVelocity * dtSeconds,
      SKY_RIDERS_RUN_RULES.logicalWidth,
    ),
    y: rider.position.y + verticalVelocity * dtSeconds,
  });
  const platform = landingPlatform(
    rider.position,
    nextPosition,
    verticalVelocity,
    SKY_RIDERS_RUN_RULES.riderHalfWidth,
    SKY_RIDERS_RUN_RULES.riderHalfHeight,
    platforms,
  );
  const position =
    platform === null
      ? nextPosition
      : Object.freeze({
          x: nextPosition.x,
          y: platform.y - SKY_RIDERS_RUN_RULES.riderHalfHeight,
        });
  if (platform !== null) verticalVelocity = 0;

  const nextRider = Object.freeze({
    ...rider,
    position,
    velocity: Object.freeze({ x: horizontalVelocity, y: verticalVelocity }),
    facing: input.horizontal === 0 ? rider.facing : input.horizontal,
    grounded: platform !== null,
    flapCooldownSeconds: flapped ? SKY_RIDERS_RUN_RULES.flapCooldownSeconds : cooldown,
    invulnerabilitySeconds: Math.max(0, rider.invulnerabilitySeconds - dtSeconds),
  });
  return Object.freeze({
    rider: nextRider,
    flapped,
    landedPlatformId: platform?.id ?? null,
  });
}

export function riderOverlap(
  first: SkyRidersRiderState,
  second: SkyRidersRiderState,
): boolean {
  const rawDx = Math.abs(first.position.x - second.position.x);
  const wrappedDx = Math.min(rawDx, SKY_RIDERS_RUN_RULES.logicalWidth - rawDx);
  return (
    wrappedDx <= SKY_RIDERS_RUN_RULES.riderHalfWidth * 2 &&
    Math.abs(first.position.y - second.position.y) <= SKY_RIDERS_RUN_RULES.riderHalfHeight * 2
  );
}

export type SkyRidersCombatOutcome = "first" | "second" | "tie";

export function resolveAltitudeCombat(
  first: SkyRidersRiderState,
  second: SkyRidersRiderState,
): SkyRidersCombatOutcome {
  const delta = second.position.y - first.position.y;
  if (delta >= SKY_RIDERS_RUN_RULES.altitudeVictoryPixels) return "first";
  if (delta <= -SKY_RIDERS_RUN_RULES.altitudeVictoryPixels) return "second";
  return "tie";
}

export function bounceRiderFromTie(
  rider: SkyRidersRiderState,
  horizontalDirection: -1 | 1,
): SkyRidersRiderState {
  return Object.freeze({
    ...rider,
    velocity: Object.freeze({
      x: horizontalDirection * SKY_RIDERS_RUN_RULES.collisionBounceSpeed,
      y: -SKY_RIDERS_RUN_RULES.collisionBounceSpeed * 0.55,
    }),
    grounded: false,
  });
}
