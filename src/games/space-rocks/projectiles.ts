import type { Vector2 } from "../../engine/index.js";
import type { SpaceRocksShipState } from "./ship.js";
import {
  advanceWrappedSpaceRocksPosition,
  wrapSpaceRocksPosition,
} from "./world.js";

export interface SpaceRocksPulseBolt {
  readonly id: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly ageSeconds: number;
}

export const SPACE_ROCKS_PROJECTILE_RULES = Object.freeze({
  fireIntervalSeconds: 0.16,
  lifetimeSeconds: 1.35,
  maxActive: 8,
  muzzleOffsetPixels: 10,
  speedPixelsPerSecond: 168,
});

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function facingVector(facingRadians: number): Vector2 {
  return {
    x: Math.sin(facingRadians),
    y: -Math.cos(facingRadians),
  };
}

export class SpaceRocksProjectileSystem {
  private active: readonly SpaceRocksPulseBolt[] = Object.freeze([]);
  private cooldownSeconds = 0;
  private nextId = 1;

  public get bolts(): readonly SpaceRocksPulseBolt[] {
    return this.active;
  }

  public get cooldownRemainingSeconds(): number {
    return this.cooldownSeconds;
  }

  public tryFire(ship: SpaceRocksShipState): boolean {
    if (
      this.cooldownSeconds > 0 ||
      this.active.length >= SPACE_ROCKS_PROJECTILE_RULES.maxActive
    ) {
      return false;
    }

    const direction = facingVector(ship.facingRadians);
    const position = wrapSpaceRocksPosition({
      x: ship.position.x + direction.x * SPACE_ROCKS_PROJECTILE_RULES.muzzleOffsetPixels,
      y: ship.position.y + direction.y * SPACE_ROCKS_PROJECTILE_RULES.muzzleOffsetPixels,
    });
    const bolt: SpaceRocksPulseBolt = Object.freeze({
      id: this.nextId++,
      position,
      velocity: Object.freeze({
        x:
          ship.velocity.x +
          direction.x * SPACE_ROCKS_PROJECTILE_RULES.speedPixelsPerSecond,
        y:
          ship.velocity.y +
          direction.y * SPACE_ROCKS_PROJECTILE_RULES.speedPixelsPerSecond,
      }),
      ageSeconds: 0,
    });

    this.active = Object.freeze([...this.active, bolt]);
    this.cooldownSeconds = SPACE_ROCKS_PROJECTILE_RULES.fireIntervalSeconds;
    return true;
  }

  public update(dtSeconds: number): void {
    requireDelta(dtSeconds);
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - dtSeconds);
    this.active = Object.freeze(
      this.active
        .map((bolt) =>
          Object.freeze({
            ...bolt,
            position: advanceWrappedSpaceRocksPosition(
              bolt.position,
              bolt.velocity,
              dtSeconds,
            ),
            ageSeconds: bolt.ageSeconds + dtSeconds,
          }),
        )
        .filter(
          (bolt) => bolt.ageSeconds < SPACE_ROCKS_PROJECTILE_RULES.lifetimeSeconds,
        ),
    );
  }

  public remove(id: number): void {
    this.active = Object.freeze(this.active.filter((bolt) => bolt.id !== id));
  }

  public reset(): void {
    this.active = Object.freeze([]);
    this.cooldownSeconds = 0;
    this.nextId = 1;
  }
}
