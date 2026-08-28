import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  SPACE_ROCKS_DIFFICULTIES,
  SPACE_ROCKS_RUN_RULES,
  SPACE_ROCKS_SCORING,
  spaceRocksWaveClearScore,
  type SpaceRocksDifficultyId,
} from "./design.js";
import { SpaceRocksProjectileSystem } from "./projectiles.js";
import {
  SpaceRocksRockFactory,
  spaceRocksRockRadius,
  type SpaceRocksRock,
  type SpaceRocksRockSize,
} from "./rocks.js";
import {
  createSpaceRocksShip,
  stepSpaceRocksShip,
  type SpaceRocksShipState,
} from "./ship.js";
import {
  wrapSpaceRocksPosition,
  wrappedSpaceRocksDistanceSquared,
} from "./world.js";

export interface SpaceRocksFrameInput {
  readonly rotate: -1 | 0 | 1;
  readonly thrust: boolean;
  readonly fire: boolean;
}

export type SpaceRocksSimulationEvent =
  | { readonly type: "pulse-fired"; readonly position: Vector2 }
  | {
      readonly type: "rock-fractured";
      readonly size: SpaceRocksRockSize;
      readonly points: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "ship-hit";
      readonly livesRemaining: number;
      readonly position: Vector2;
    }
  | { readonly type: "wave-cleared"; readonly wave: number; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };

export interface SpaceRocksSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: SpaceRocksDifficultyId;
  readonly initialRocks?: readonly SpaceRocksRock[];
  readonly initialLives?: number;
  readonly initialInvulnerabilitySeconds?: number;
}

const SHIP_COLLISION_RADIUS = 7;
const BOLT_COLLISION_RADIUS = 2;

function pointsForRock(size: SpaceRocksRockSize): number {
  switch (size) {
    case "large":
      return SPACE_ROCKS_SCORING.largeRock;
    case "medium":
      return SPACE_ROCKS_SCORING.mediumRock;
    case "small":
      return SPACE_ROCKS_SCORING.smallRock;
  }
}

function intersectsWrappedCircles(
  a: {
    readonly position: { readonly x: number; readonly y: number };
    readonly radius: number;
  },
  b: {
    readonly position: { readonly x: number; readonly y: number };
    readonly radius: number;
  },
): boolean {
  const radius = a.radius + b.radius;
  return wrappedSpaceRocksDistanceSquared(a.position, b.position) <= radius * radius;
}

export class SpaceRocksSimulation {
  private shipState: SpaceRocksShipState;
  private rockState: readonly SpaceRocksRock[];
  private readonly projectiles = new SpaceRocksProjectileSystem();
  private readonly rockFactory: SpaceRocksRockFactory;
  private livesValue: number;
  private scoreValue = 0;
  private waveValue = 1;
  private invulnerabilityValue: number;
  private gameOverValue = false;

  public constructor(private readonly options: SpaceRocksSimulationOptions) {
    this.rockFactory = new SpaceRocksRockFactory(options.rng, options.difficulty);
    this.shipState = this.createRespawnedShip();
    this.rockState = Object.freeze(
      options.initialRocks === undefined
        ? [...this.rockFactory.createInitialWave(1)]
        : [...options.initialRocks],
    );
    this.livesValue = options.initialLives ?? SPACE_ROCKS_RUN_RULES.startingLives;
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue <= 0) {
      throw new RangeError("initialLives must be a positive safe integer");
    }
    this.invulnerabilityValue =
      options.initialInvulnerabilitySeconds ??
      SPACE_ROCKS_DIFFICULTIES[options.difficulty].spawnProtectionSeconds;
    if (!Number.isFinite(this.invulnerabilityValue) || this.invulnerabilityValue < 0) {
      throw new RangeError(
        "initialInvulnerabilitySeconds must be non-negative and finite",
      );
    }
  }

  public get ship(): SpaceRocksShipState {
    return this.shipState;
  }

  public get rocks(): readonly SpaceRocksRock[] {
    return this.rockState;
  }

  public get bolts() {
    return this.projectiles.bolts;
  }

  public get lives(): number {
    return this.livesValue;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get wave(): number {
    return this.waveValue;
  }

  public get invulnerabilitySeconds(): number {
    return this.invulnerabilityValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public update(
    input: SpaceRocksFrameInput,
    dtSeconds: number,
  ): readonly SpaceRocksSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: SpaceRocksSimulationEvent[] = [];
    const steppedShip = stepSpaceRocksShip(this.shipState, input, dtSeconds);
    this.shipState = Object.freeze({
      ...steppedShip,
      position: wrapSpaceRocksPosition(steppedShip.position),
    });

    if (input.fire && this.projectiles.tryFire(this.shipState)) {
      const bolt = this.projectiles.bolts[this.projectiles.bolts.length - 1];
      if (bolt !== undefined) {
        events.push(
          Object.freeze({ type: "pulse-fired", position: bolt.position }),
        );
      }
    }
    this.projectiles.update(dtSeconds);
    this.rockState = Object.freeze(
      this.rockState.map((rock) => this.rockFactory.update(rock, dtSeconds)),
    );
    this.invulnerabilityValue = Math.max(0, this.invulnerabilityValue - dtSeconds);

    this.resolveProjectileHits(events);
    this.resolveShipHit(events);
    this.resolveWaveClear(events);

    return Object.freeze(events);
  }

  private resolveProjectileHits(events: SpaceRocksSimulationEvent[]): void {
    const rocks = [...this.rockState];
    for (const bolt of [...this.projectiles.bolts]) {
      const hitIndex = rocks.findIndex((rock) =>
        intersectsWrappedCircles(
          { position: bolt.position, radius: BOLT_COLLISION_RADIUS },
          { position: rock.position, radius: spaceRocksRockRadius(rock.size) },
        ),
      );
      if (hitIndex < 0) {
        continue;
      }
      const hit = rocks[hitIndex];
      if (hit === undefined) {
        continue;
      }
      rocks.splice(hitIndex, 1, ...this.rockFactory.split(hit));
      this.projectiles.remove(bolt.id);
      const points = pointsForRock(hit.size);
      this.scoreValue += points;
      events.push(
        Object.freeze({
          type: "rock-fractured",
          size: hit.size,
          points,
          position: hit.position,
        }),
      );
    }
    this.rockState = Object.freeze(rocks);
  }

  private resolveShipHit(events: SpaceRocksSimulationEvent[]): void {
    if (this.invulnerabilityValue > 0) {
      return;
    }
    const collided = this.rockState.some((rock) =>
      intersectsWrappedCircles(
        { position: this.shipState.position, radius: SHIP_COLLISION_RADIUS },
        { position: rock.position, radius: spaceRocksRockRadius(rock.size) },
      ),
    );
    if (!collided) {
      return;
    }

    const collisionPosition = this.shipState.position;
    this.livesValue -= 1;
    events.push(
      Object.freeze({
        type: "ship-hit",
        livesRemaining: this.livesValue,
        position: collisionPosition,
      }),
    );
    if (this.livesValue <= 0) {
      this.gameOverValue = true;
      this.projectiles.reset();
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      return;
    }

    this.shipState = this.createRespawnedShip();
    this.projectiles.reset();
    this.invulnerabilityValue =
      SPACE_ROCKS_DIFFICULTIES[this.options.difficulty].spawnProtectionSeconds;
  }

  private resolveWaveClear(events: SpaceRocksSimulationEvent[]): void {
    if (this.gameOverValue || this.rockState.length !== 0) {
      return;
    }
    const clearedWave = this.waveValue;
    const bonus = spaceRocksWaveClearScore(clearedWave);
    this.scoreValue += bonus;
    events.push(
      Object.freeze({ type: "wave-cleared", wave: clearedWave, bonus }),
    );
    this.waveValue += 1;
    this.rockState = this.rockFactory.createInitialWave(this.waveValue);
  }

  private createRespawnedShip(): SpaceRocksShipState {
    return createSpaceRocksShip({
      x: SPACE_ROCKS_RUN_RULES.logicalWidth / 2,
      y: SPACE_ROCKS_RUN_RULES.logicalHeight / 2,
    });
  }
}
