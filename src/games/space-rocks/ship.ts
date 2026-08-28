import { length, type Vector2 } from "../../engine/index.js";

export interface SpaceRocksShipState {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly facingRadians: number;
  readonly thrusting: boolean;
}

export interface SpaceRocksShipInput {
  readonly rotate: -1 | 0 | 1;
  readonly thrust: boolean;
}

export const SPACE_ROCKS_SHIP_PHYSICS = Object.freeze({
  rotationRadiansPerSecond: Math.PI * 1.45,
  thrustPixelsPerSecondSquared: 72,
  maxSpeedPixelsPerSecond: 92,
});

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function clampVelocity(velocity: Vector2, maxSpeed: number): Vector2 {
  const speed = length(velocity);
  if (speed <= maxSpeed || speed === 0) {
    return velocity;
  }
  const scale = maxSpeed / speed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}

export function createSpaceRocksShip(position: Vector2): SpaceRocksShipState {
  return Object.freeze({
    position: Object.freeze({ ...position }),
    velocity: Object.freeze({ x: 0, y: 0 }),
    facingRadians: 0,
    thrusting: false,
  });
}

export function stepSpaceRocksShip(
  state: SpaceRocksShipState,
  input: SpaceRocksShipInput,
  dtSeconds: number,
): SpaceRocksShipState {
  requireDelta(dtSeconds);

  const facingRadians =
    state.facingRadians +
    input.rotate * SPACE_ROCKS_SHIP_PHYSICS.rotationRadiansPerSecond * dtSeconds;

  let velocity = state.velocity;
  if (input.thrust && dtSeconds > 0) {
    const acceleration = SPACE_ROCKS_SHIP_PHYSICS.thrustPixelsPerSecondSquared;
    velocity = {
      x: velocity.x + Math.sin(facingRadians) * acceleration * dtSeconds,
      y: velocity.y - Math.cos(facingRadians) * acceleration * dtSeconds,
    };
  }
  velocity = clampVelocity(velocity, SPACE_ROCKS_SHIP_PHYSICS.maxSpeedPixelsPerSecond);

  return Object.freeze({
    position: Object.freeze({
      x: state.position.x + velocity.x * dtSeconds,
      y: state.position.y + velocity.y * dtSeconds,
    }),
    velocity: Object.freeze({ ...velocity }),
    facingRadians,
    thrusting: input.thrust,
  });
}
