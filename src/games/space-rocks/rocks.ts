import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  SPACE_ROCKS_DIFFICULTIES,
  type SpaceRocksDifficultyId,
} from "./design.js";
import { advanceWrappedSpaceRocksPosition } from "./world.js";

export type SpaceRocksRockSize = "large" | "medium" | "small";

export interface SpaceRocksRock {
  readonly id: number;
  readonly size: SpaceRocksRockSize;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly rotationRadians: number;
  readonly angularVelocityRadiansPerSecond: number;
  readonly shapeSeed: number;
}

export const SPACE_ROCKS_ROCK_RULES = Object.freeze({
  radius: Object.freeze({ large: 18, medium: 11, small: 6 }),
  baseSpeed: Object.freeze({ large: 22, medium: 31, small: 43 }),
  maximumInitialLargeRocks: 9,
  waveSpeedIncrease: 0.04,
  maximumWaveSpeedScale: 1.45,
});

function randomAngle(rng: RandomService): number {
  return rng.nextFloat() * Math.PI * 2;
}

function velocityFromAngle(angle: number, speed: number): Vector2 {
  return Object.freeze({ x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function waveSpeedScale(wave: number): number {
  return Math.min(
    SPACE_ROCKS_ROCK_RULES.maximumWaveSpeedScale,
    1 + SPACE_ROCKS_ROCK_RULES.waveSpeedIncrease * (wave - 1),
  );
}

function requireWave(wave: number): void {
  if (!Number.isSafeInteger(wave) || wave < 1) {
    throw new RangeError("wave must be a positive safe integer");
  }
}

export function spaceRocksRockRadius(size: SpaceRocksRockSize): number {
  return SPACE_ROCKS_ROCK_RULES.radius[size];
}

export class SpaceRocksRockFactory {
  private nextId = 1;

  public constructor(
    private readonly rng: RandomService,
    private readonly difficulty: SpaceRocksDifficultyId,
  ) {}

  public createInitialWave(wave: number): readonly SpaceRocksRock[] {
    requireWave(wave);
    const profile = SPACE_ROCKS_DIFFICULTIES[this.difficulty];
    const count = Math.min(
      SPACE_ROCKS_ROCK_RULES.maximumInitialLargeRocks,
      profile.initialLargeRocks + Math.floor((wave - 1) / 2),
    );
    const speedScale = profile.rockSpeedScale * waveSpeedScale(wave);
    return Object.freeze(
      Array.from({ length: count }, () =>
        this.createRock("large", this.randomPerimeterPosition(), speedScale),
      ),
    );
  }

  public split(parent: SpaceRocksRock): readonly SpaceRocksRock[] {
    const childSize: SpaceRocksRockSize | null =
      parent.size === "large" ? "medium" : parent.size === "medium" ? "small" : null;
    if (childSize === null) {
      return Object.freeze([]);
    }

    const parentHeading = Math.atan2(parent.velocity.y, parent.velocity.x);
    const spread = 0.42 + this.rng.nextFloat() * 0.5;
    const speedJitter = 0.92 + this.rng.nextFloat() * 0.18;
    const baseSpeed = SPACE_ROCKS_ROCK_RULES.baseSpeed[childSize] * speedJitter;

    return Object.freeze([
      this.createRockAtHeading(childSize, parent.position, parentHeading - spread, baseSpeed),
      this.createRockAtHeading(childSize, parent.position, parentHeading + spread, baseSpeed),
    ]);
  }

  public update(rock: SpaceRocksRock, dtSeconds: number): SpaceRocksRock {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    return Object.freeze({
      ...rock,
      position: advanceWrappedSpaceRocksPosition(rock.position, rock.velocity, dtSeconds),
      rotationRadians:
        rock.rotationRadians + rock.angularVelocityRadiansPerSecond * dtSeconds,
    });
  }

  private createRock(
    size: SpaceRocksRockSize,
    position: Vector2,
    speedScale: number,
  ): SpaceRocksRock {
    const heading = randomAngle(this.rng);
    const speed =
      SPACE_ROCKS_ROCK_RULES.baseSpeed[size] *
      speedScale *
      (0.85 + this.rng.nextFloat() * 0.3);
    return this.createRockAtHeading(size, position, heading, speed);
  }

  private createRockAtHeading(
    size: SpaceRocksRockSize,
    position: Vector2,
    heading: number,
    speed: number,
  ): SpaceRocksRock {
    const spinMagnitude = 0.24 + this.rng.nextFloat() * 0.62;
    const spinDirection = this.rng.nextFloat() < 0.5 ? -1 : 1;
    return Object.freeze({
      id: this.nextId++,
      size,
      position: Object.freeze({ ...position }),
      velocity: velocityFromAngle(heading, speed),
      rotationRadians: randomAngle(this.rng),
      angularVelocityRadiansPerSecond: spinMagnitude * spinDirection,
      shapeSeed: this.rng.nextUint32(),
    });
  }

  private randomPerimeterPosition(): Vector2 {
    const edge = Math.floor(this.rng.nextFloat() * 4);
    const coordinate = this.rng.nextFloat();
    switch (edge) {
      case 0:
        return Object.freeze({ x: coordinate * 320, y: 0 });
      case 1:
        return Object.freeze({ x: 319, y: coordinate * 240 });
      case 2:
        return Object.freeze({ x: coordinate * 320, y: 239 });
      default:
        return Object.freeze({ x: 0, y: coordinate * 240 });
    }
  }
}
