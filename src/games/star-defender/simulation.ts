import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  STAR_DEFENDER_DIFFICULTIES,
  STAR_DEFENDER_RUN_RULES,
  STAR_DEFENDER_SCORING,
  starDefenderWaveClearScore,
  starDefenderWaveEnemyCount,
  type StarDefenderDifficultyId,
} from "./design.js";
import {
  createStarDefenderPlayer,
  stepStarDefenderPlayer,
  type StarDefenderPlayerState,
} from "./player.js";
import {
  starDefenderTerrainY,
  wrapStarDefenderWorldX,
  wrappedStarDefenderDeltaX,
  wrappedStarDefenderDistanceSquared,
} from "./world.js";

export type StarDefenderEnemyType = "snatcher" | "stalker" | "skimmer";
export type StarDefenderInhabitantState =
  | "ground"
  | "abducted"
  | "falling"
  | "carried"
  | "lost";

export interface StarDefenderEnemy {
  readonly id: number;
  readonly type: StarDefenderEnemyType;
  readonly x: number;
  readonly y: number;
  readonly heading: -1 | 1;
  readonly phase: number;
  readonly ageSeconds: number;
  readonly targetInhabitantId: number | null;
  readonly carryingInhabitantId: number | null;
}

export interface StarDefenderInhabitant {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly state: StarDefenderInhabitantState;
  readonly carrierEnemyId: number | null;
  readonly velocityY: number;
}

export interface StarDefenderProjectile {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly ageSeconds: number;
}

export interface StarDefenderFrameInput {
  readonly horizontal: -1 | 0 | 1;
  readonly vertical: -1 | 0 | 1;
  readonly fire: boolean;
  readonly emergency: boolean;
}

export type StarDefenderSimulationEvent =
  | { readonly type: "lance-fired"; readonly position: Vector2 }
  | {
      readonly type: "emergency-used";
      readonly position: Vector2;
      readonly destroyed: number;
      readonly chargesRemaining: number;
    }
  | {
      readonly type: "enemy-destroyed";
      readonly enemyType: StarDefenderEnemyType;
      readonly points: number;
      readonly position: Vector2;
      readonly cause: "lance" | "emergency";
    }
  | {
      readonly type: "abduction-started";
      readonly inhabitantId: number;
      readonly enemyId: number;
    }
  | {
      readonly type: "inhabitant-falling";
      readonly inhabitantId: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "inhabitant-caught";
      readonly inhabitantId: number;
      readonly points: number;
    }
  | {
      readonly type: "inhabitant-returned";
      readonly inhabitantId: number;
      readonly points: number;
    }
  | { readonly type: "inhabitant-lost"; readonly inhabitantId: number }
  | {
      readonly type: "player-hit";
      readonly livesRemaining: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "wave-cleared";
      readonly wave: number;
      readonly bonus: number;
      readonly emergencyCharges: number;
    }
  | { readonly type: "game-over"; readonly score: number };

export interface StarDefenderSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: StarDefenderDifficultyId;
  readonly initialPlayer?: StarDefenderPlayerState;
  readonly initialEnemies?: readonly StarDefenderEnemy[];
  readonly initialInhabitants?: readonly StarDefenderInhabitant[];
  readonly initialLives?: number;
  readonly initialEmergencyCharges?: number;
  readonly initialInvulnerabilitySeconds?: number;
  readonly initialWave?: number;
}

const FALL_GRAVITY = 58;
const SNATCHER_SPEED = 45;
const STALKER_SPEED = 58;
const SKIMMER_SPEED = 64;
const SNATCHER_CAPTURE_RADIUS = 9;
const PROJECTILE_HIT_RADIUS =
  STAR_DEFENDER_RUN_RULES.enemyRadius + STAR_DEFENDER_RUN_RULES.projectileRadius;
const PLAYER_HIT_RADIUS =
  STAR_DEFENDER_RUN_RULES.enemyRadius + STAR_DEFENDER_RUN_RULES.playerRadius;
const RESCUE_CATCH_RADIUS =
  STAR_DEFENDER_RUN_RULES.playerRadius + STAR_DEFENDER_RUN_RULES.inhabitantRadius + 2;

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function moveToward(current: number, target: number, maximumDelta: number): number {
  if (current < target) {
    return Math.min(target, current + maximumDelta);
  }
  return Math.max(target, current - maximumDelta);
}

function enemyScore(type: StarDefenderEnemyType): number {
  return STAR_DEFENDER_SCORING[type];
}

function freezeEnemy(enemy: StarDefenderEnemy): StarDefenderEnemy {
  return Object.freeze(enemy);
}

function freezeInhabitant(
  inhabitant: StarDefenderInhabitant,
): StarDefenderInhabitant {
  return Object.freeze(inhabitant);
}

function freezeProjectile(
  projectile: StarDefenderProjectile,
): StarDefenderProjectile {
  return Object.freeze(projectile);
}

function position(entity: { readonly x: number; readonly y: number }): Vector2 {
  return Object.freeze({ x: entity.x, y: entity.y });
}

export class StarDefenderSimulation {
  private playerState: StarDefenderPlayerState;
  private enemyState: readonly StarDefenderEnemy[];
  private inhabitantState: readonly StarDefenderInhabitant[];
  private projectileState: readonly StarDefenderProjectile[] = Object.freeze([]);
  private livesValue: number;
  private emergencyChargesValue: number;
  private scoreValue = 0;
  private waveValue: number;
  private invulnerabilityValue: number;
  private fireCooldownValue = 0;
  private emergencyLatched = false;
  private gameOverValue = false;
  private nextEnemyId = 1;
  private nextProjectileId = 1;

  public constructor(private readonly options: StarDefenderSimulationOptions) {
    this.playerState = options.initialPlayer ?? createStarDefenderPlayer();
    this.livesValue = options.initialLives ?? STAR_DEFENDER_RUN_RULES.startingLives;
    this.emergencyChargesValue =
      options.initialEmergencyCharges ?? STAR_DEFENDER_RUN_RULES.startingEmergencyCharges;
    this.waveValue = options.initialWave ?? 1;
    this.invulnerabilityValue = options.initialInvulnerabilitySeconds ?? 0.75;
    this.inhabitantState = Object.freeze(
      options.initialInhabitants === undefined
        ? this.createInitialInhabitants()
        : options.initialInhabitants.map((entry) => freezeInhabitant({ ...entry })),
    );
    this.enemyState = Object.freeze(
      options.initialEnemies === undefined
        ? this.createWave(this.waveValue)
        : options.initialEnemies.map((entry) => freezeEnemy({ ...entry })),
    );
    this.nextEnemyId =
      this.enemyState.reduce((maximum, enemy) => Math.max(maximum, enemy.id), 0) + 1;
  }

  public get player(): StarDefenderPlayerState {
    return this.playerState;
  }

  public get enemies(): readonly StarDefenderEnemy[] {
    return this.enemyState;
  }

  public get inhabitants(): readonly StarDefenderInhabitant[] {
    return this.inhabitantState;
  }

  public get projectiles(): readonly StarDefenderProjectile[] {
    return this.projectileState;
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

  public get emergencyCharges(): number {
    return this.emergencyChargesValue;
  }

  public get invulnerabilitySeconds(): number {
    return this.invulnerabilityValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public update(
    input: StarDefenderFrameInput,
    dtSeconds: number,
  ): readonly StarDefenderSimulationEvent[] {
    requireDelta(dtSeconds);
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: StarDefenderSimulationEvent[] = [];
    this.invulnerabilityValue = Math.max(0, this.invulnerabilityValue - dtSeconds);
    this.fireCooldownValue = Math.max(0, this.fireCooldownValue - dtSeconds);
    this.playerState = stepStarDefenderPlayer(
      this.playerState,
      { horizontal: input.horizontal, vertical: input.vertical },
      dtSeconds,
    );

    this.updateInhabitants(dtSeconds, events);
    this.updateEnemies(dtSeconds, events);
    this.updateProjectiles(dtSeconds);
    this.handleFire(input.fire, events);
    this.handleEmergency(input.emergency, events);
    this.resolveProjectileHits(events);
    this.resolveFallingCatches(events);
    this.resolvePlayerHit(events);

    if (this.endIfObjectivesLost(events)) {
      return Object.freeze(events);
    }
    this.resolveWaveClear(events);
    return Object.freeze(events);
  }

  private createInitialInhabitants(): readonly StarDefenderInhabitant[] {
    const result: StarDefenderInhabitant[] = [];
    const spacing =
      STAR_DEFENDER_RUN_RULES.worldWidth / STAR_DEFENDER_RUN_RULES.inhabitantCount;
    for (let index = 0; index < STAR_DEFENDER_RUN_RULES.inhabitantCount; index += 1) {
      const jitter = (this.options.rng.nextFloat() - 0.5) * spacing * 0.28;
      const x = wrapStarDefenderWorldX(spacing * (index + 0.5) + jitter);
      result.push(
        freezeInhabitant({
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

  private createWave(wave: number): readonly StarDefenderEnemy[] {
    const count = starDefenderWaveEnemyCount(wave, this.options.difficulty);
    const result: StarDefenderEnemy[] = [];
    for (let index = 0; index < count; index += 1) {
      const selector = (index + wave) % 6;
      const type: StarDefenderEnemyType =
        selector < 3 ? "snatcher" : selector < 5 ? "stalker" : "skimmer";
      const x = this.options.rng.nextFloat() * STAR_DEFENDER_RUN_RULES.worldWidth;
      const y = 64 + this.options.rng.nextFloat() * 92;
      const heading: -1 | 1 = this.options.rng.nextFloat() < 0.5 ? -1 : 1;
      result.push(
        freezeEnemy({
          id: this.nextEnemyId,
          type,
          x,
          y,
          heading,
          phase: this.options.rng.nextFloat() * Math.PI * 2,
          ageSeconds: 0,
          targetInhabitantId: null,
          carryingInhabitantId: null,
        }),
      );
      this.nextEnemyId += 1;
    }
    return Object.freeze(result);
  }

  private updateInhabitants(
    dtSeconds: number,
    events: StarDefenderSimulationEvent[],
  ): void {
    const next = this.inhabitantState.map((inhabitant) => {
      switch (inhabitant.state) {
        case "ground":
          return freezeInhabitant({
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
            return freezeInhabitant({
              ...inhabitant,
              y: starDefenderTerrainY(inhabitant.x) - 3,
              state: "lost",
              velocityY: 0,
            });
          }
          return freezeInhabitant({ ...inhabitant, y, velocityY });
        }
        case "carried": {
          const x = this.playerState.x;
          const y = this.playerState.y + 10;
          if (this.playerState.y >= starDefenderTerrainY(x) - 19) {
            const points = STAR_DEFENDER_SCORING.safeReturn;
            this.scoreValue += points;
            events.push(
              Object.freeze({
                type: "inhabitant-returned",
                inhabitantId: inhabitant.id,
                points,
              }),
            );
            return freezeInhabitant({
              ...inhabitant,
              x,
              y: starDefenderTerrainY(x) - 3,
              state: "ground",
              carrierEnemyId: null,
              velocityY: 0,
            });
          }
          return freezeInhabitant({ ...inhabitant, x, y, velocityY: 0 });
        }
        case "lost":
          return inhabitant;
      }
    });
    this.inhabitantState = Object.freeze(next);
  }

  private updateEnemies(
    dtSeconds: number,
    events: StarDefenderSimulationEvent[],
  ): void {
    const inhabitants = [...this.inhabitantState];
    const speedScale = STAR_DEFENDER_DIFFICULTIES[this.options.difficulty].enemySpeedScale;
    const next = this.enemyState.map((enemy) => {
      const ageSeconds = enemy.ageSeconds + dtSeconds;
      switch (enemy.type) {
        case "snatcher":
          return this.updateSnatcher(
            { ...enemy, ageSeconds },
            inhabitants,
            speedScale,
            dtSeconds,
            events,
          );
        case "stalker": {
          const dx = wrappedStarDefenderDeltaX(enemy.x, this.playerState.x);
          const heading: -1 | 1 = dx < 0 ? -1 : 1;
          const x = wrapStarDefenderWorldX(
            enemy.x + heading * STALKER_SPEED * speedScale * dtSeconds,
          );
          const y = moveToward(
            enemy.y,
            this.playerState.y,
            STALKER_SPEED * 0.72 * speedScale * dtSeconds,
          );
          return freezeEnemy({ ...enemy, x, y, heading, ageSeconds });
        }
        case "skimmer": {
          const x = wrapStarDefenderWorldX(
            enemy.x + enemy.heading * SKIMMER_SPEED * speedScale * dtSeconds,
          );
          const targetY = 106 + Math.sin(ageSeconds * 1.75 + enemy.phase) * 28;
          const y = moveToward(enemy.y, targetY, 46 * speedScale * dtSeconds);
          return freezeEnemy({ ...enemy, x, y, ageSeconds });
        }
      }
    });
    this.enemyState = Object.freeze(next);
    this.inhabitantState = Object.freeze(inhabitants);
  }

  private updateSnatcher(
    enemy: StarDefenderEnemy,
    inhabitants: StarDefenderInhabitant[],
    speedScale: number,
    dtSeconds: number,
    events: StarDefenderSimulationEvent[],
  ): StarDefenderEnemy {
    const abductionScale =
      STAR_DEFENDER_DIFFICULTIES[this.options.difficulty].abductionSpeedScale;
    const carryingId = enemy.carryingInhabitantId;
    if (carryingId !== null) {
      const inhabitantIndex = inhabitants.findIndex((entry) => entry.id === carryingId);
      const inhabitant = inhabitants[inhabitantIndex];
      const y = enemy.y - SNATCHER_SPEED * 0.72 * abductionScale * dtSeconds;
      const x = wrapStarDefenderWorldX(
        enemy.x + enemy.heading * SNATCHER_SPEED * 0.13 * speedScale * dtSeconds,
      );
      if (inhabitant !== undefined) {
        if (y <= STAR_DEFENDER_RUN_RULES.playfieldTop + 2) {
          inhabitants[inhabitantIndex] = freezeInhabitant({
            ...inhabitant,
            x,
            y: STAR_DEFENDER_RUN_RULES.playfieldTop,
            state: "lost",
            carrierEnemyId: null,
            velocityY: 0,
          });
          events.push(
            Object.freeze({ type: "inhabitant-lost", inhabitantId: inhabitant.id }),
          );
          return freezeEnemy({
            ...enemy,
            x,
            y: STAR_DEFENDER_RUN_RULES.playfieldTop + 8,
            carryingInhabitantId: null,
            targetInhabitantId: null,
          });
        }
        inhabitants[inhabitantIndex] = freezeInhabitant({
          ...inhabitant,
          x,
          y: y + 9,
          state: "abducted",
          carrierEnemyId: enemy.id,
          velocityY: 0,
        });
      }
      return freezeEnemy({ ...enemy, x, y });
    }

    const ground = inhabitants.filter((entry) => entry.state === "ground");
    if (ground.length === 0) {
      const x = wrapStarDefenderWorldX(
        enemy.x + enemy.heading * SNATCHER_SPEED * 0.7 * speedScale * dtSeconds,
      );
      const y = moveToward(enemy.y, 92, 32 * speedScale * dtSeconds);
      return freezeEnemy({
        ...enemy,
        x,
        y,
        targetInhabitantId: null,
      });
    }

    let target = ground[0];
    if (target === undefined) {
      return freezeEnemy(enemy);
    }
    let closest = Math.abs(wrappedStarDefenderDeltaX(enemy.x, target.x));
    for (const candidate of ground.slice(1)) {
      const distance = Math.abs(wrappedStarDefenderDeltaX(enemy.x, candidate.x));
      if (distance < closest) {
        target = candidate;
        closest = distance;
      }
    }

    const dx = wrappedStarDefenderDeltaX(enemy.x, target.x);
    const heading: -1 | 1 = dx < 0 ? -1 : 1;
    const maximumHorizontal = SNATCHER_SPEED * speedScale * dtSeconds;
    const x = wrapStarDefenderWorldX(
      enemy.x + clamp(dx, -maximumHorizontal, maximumHorizontal),
    );
    const captureY = starDefenderTerrainY(target.x) - 14;
    const y = moveToward(
      enemy.y,
      captureY,
      SNATCHER_SPEED * 0.8 * speedScale * dtSeconds,
    );
    const closeEnough =
      wrappedStarDefenderDistanceSquared(
        { x, y },
        { x: target.x, y: captureY },
      ) <=
      SNATCHER_CAPTURE_RADIUS * SNATCHER_CAPTURE_RADIUS;

    if (closeEnough) {
      const targetIndex = inhabitants.findIndex((entry) => entry.id === target.id);
      const current = inhabitants[targetIndex];
      if (current !== undefined && current.state === "ground") {
        inhabitants[targetIndex] = freezeInhabitant({
          ...current,
          x,
          y: y + 9,
          state: "abducted",
          carrierEnemyId: enemy.id,
          velocityY: 0,
        });
        events.push(
          Object.freeze({
            type: "abduction-started",
            inhabitantId: current.id,
            enemyId: enemy.id,
          }),
        );
        return freezeEnemy({
          ...enemy,
          x,
          y,
          heading,
          targetInhabitantId: current.id,
          carryingInhabitantId: current.id,
        });
      }
    }

    return freezeEnemy({
      ...enemy,
      x,
      y,
      heading,
      targetInhabitantId: target.id,
    });
  }

  private updateProjectiles(dtSeconds: number): void {
    this.projectileState = Object.freeze(
      this.projectileState
        .map((projectile) =>
          freezeProjectile({
            ...projectile,
            x: wrapStarDefenderWorldX(projectile.x + projectile.velocityX * dtSeconds),
            ageSeconds: projectile.ageSeconds + dtSeconds,
          }),
        )
        .filter(
          (projectile) =>
            projectile.ageSeconds < STAR_DEFENDER_RUN_RULES.projectileLifetimeSeconds,
        ),
    );
  }

  private handleFire(
    fire: boolean,
    events: StarDefenderSimulationEvent[],
  ): void {
    if (
      !fire ||
      this.fireCooldownValue > 0 ||
      this.projectileState.length >= STAR_DEFENDER_RUN_RULES.maxProjectiles
    ) {
      return;
    }
    const projectile = freezeProjectile({
      id: this.nextProjectileId,
      x: wrapStarDefenderWorldX(this.playerState.x + this.playerState.facing * 10),
      y: this.playerState.y,
      velocityX:
        this.playerState.velocityX +
        this.playerState.facing * STAR_DEFENDER_RUN_RULES.projectileSpeed,
      ageSeconds: 0,
    });
    this.nextProjectileId += 1;
    this.projectileState = Object.freeze([...this.projectileState, projectile]);
    this.fireCooldownValue = STAR_DEFENDER_RUN_RULES.fireCooldownSeconds;
    events.push(
      Object.freeze({ type: "lance-fired", position: position(projectile) }),
    );
  }

  private handleEmergency(
    emergency: boolean,
    events: StarDefenderSimulationEvent[],
  ): void {
    if (!emergency) {
      this.emergencyLatched = false;
      return;
    }
    if (this.emergencyLatched) {
      return;
    }
    this.emergencyLatched = true;
    if (this.emergencyChargesValue <= 0) {
      return;
    }

    this.emergencyChargesValue -= 1;
    const inhabitants = [...this.inhabitantState];
    const destroyed = this.enemyState.length;
    for (const enemy of this.enemyState) {
      this.destroyEnemy(enemy, inhabitants, events, "emergency");
    }
    this.enemyState = Object.freeze([]);
    this.inhabitantState = Object.freeze(inhabitants);
    events.push(
      Object.freeze({
        type: "emergency-used",
        position: position(this.playerState),
        destroyed,
        chargesRemaining: this.emergencyChargesValue,
      }),
    );
  }

  private resolveProjectileHits(events: StarDefenderSimulationEvent[]): void {
    const enemies = [...this.enemyState];
    const inhabitants = [...this.inhabitantState];
    const survivingProjectiles: StarDefenderProjectile[] = [];

    for (const projectile of this.projectileState) {
      const hitIndex = enemies.findIndex(
        (enemy) =>
          wrappedStarDefenderDistanceSquared(projectile, enemy) <=
          PROJECTILE_HIT_RADIUS * PROJECTILE_HIT_RADIUS,
      );
      if (hitIndex < 0) {
        survivingProjectiles.push(projectile);
        continue;
      }
      const enemy = enemies[hitIndex];
      if (enemy === undefined) {
        survivingProjectiles.push(projectile);
        continue;
      }
      enemies.splice(hitIndex, 1);
      this.destroyEnemy(enemy, inhabitants, events, "lance");
    }

    this.enemyState = Object.freeze(enemies);
    this.inhabitantState = Object.freeze(inhabitants);
    this.projectileState = Object.freeze(survivingProjectiles);
  }

  private destroyEnemy(
    enemy: StarDefenderEnemy,
    inhabitants: StarDefenderInhabitant[],
    events: StarDefenderSimulationEvent[],
    cause: "lance" | "emergency",
  ): void {
    const points = enemyScore(enemy.type);
    this.scoreValue += points;
    events.push(
      Object.freeze({
        type: "enemy-destroyed",
        enemyType: enemy.type,
        points,
        position: position(enemy),
        cause,
      }),
    );

    const carryingId = enemy.carryingInhabitantId;
    if (carryingId === null) {
      return;
    }
    const index = inhabitants.findIndex((entry) => entry.id === carryingId);
    const inhabitant = inhabitants[index];
    if (inhabitant === undefined || inhabitant.state !== "abducted") {
      return;
    }
    const falling = freezeInhabitant({
      ...inhabitant,
      x: enemy.x,
      y: enemy.y + 9,
      state: "falling",
      carrierEnemyId: null,
      velocityY: 16,
    });
    inhabitants[index] = falling;
    events.push(
      Object.freeze({
        type: "inhabitant-falling",
        inhabitantId: falling.id,
        position: position(falling),
      }),
    );
  }

  private resolveFallingCatches(events: StarDefenderSimulationEvent[]): void {
    const inhabitants = this.inhabitantState.map((inhabitant) => {
      if (
        inhabitant.state !== "falling" ||
        wrappedStarDefenderDistanceSquared(inhabitant, this.playerState) >
          RESCUE_CATCH_RADIUS * RESCUE_CATCH_RADIUS
      ) {
        return inhabitant;
      }
      const points = STAR_DEFENDER_SCORING.fallingCatch;
      this.scoreValue += points;
      events.push(
        Object.freeze({
          type: "inhabitant-caught",
          inhabitantId: inhabitant.id,
          points,
        }),
      );
      return freezeInhabitant({
        ...inhabitant,
        x: this.playerState.x,
        y: this.playerState.y + 10,
        state: "carried",
        carrierEnemyId: null,
        velocityY: 0,
      });
    });
    this.inhabitantState = Object.freeze(inhabitants);
  }

  private resolvePlayerHit(events: StarDefenderSimulationEvent[]): void {
    if (this.invulnerabilityValue > 0) {
      return;
    }
    const hitIndex = this.enemyState.findIndex(
      (enemy) =>
        wrappedStarDefenderDistanceSquared(enemy, this.playerState) <=
        PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS,
    );
    if (hitIndex < 0) {
      return;
    }
    const enemy = this.enemyState[hitIndex];
    if (enemy === undefined) {
      return;
    }

    const inhabitants = [...this.inhabitantState];
    if (enemy.carryingInhabitantId !== null) {
      this.dropCarriedInhabitant(enemy, inhabitants, events);
    }
    const enemies = [...this.enemyState];
    enemies.splice(hitIndex, 1);
    this.enemyState = Object.freeze(enemies);
    this.inhabitantState = Object.freeze(inhabitants);

    const hitPosition = position(this.playerState);
    this.livesValue -= 1;
    events.push(
      Object.freeze({
        type: "player-hit",
        livesRemaining: this.livesValue,
        position: hitPosition,
      }),
    );
    this.projectileState = Object.freeze([]);
    if (this.livesValue <= 0) {
      this.endRun(events);
      return;
    }

    const respawn = createStarDefenderPlayer(this.playerState.x);
    this.playerState = Object.freeze({ ...respawn, facing: this.playerState.facing });
    this.invulnerabilityValue = STAR_DEFENDER_RUN_RULES.respawnProtectionSeconds;
  }

  private dropCarriedInhabitant(
    enemy: StarDefenderEnemy,
    inhabitants: StarDefenderInhabitant[],
    events: StarDefenderSimulationEvent[],
  ): void {
    const carryingId = enemy.carryingInhabitantId;
    if (carryingId === null) {
      return;
    }
    const index = inhabitants.findIndex((entry) => entry.id === carryingId);
    const inhabitant = inhabitants[index];
    if (inhabitant === undefined || inhabitant.state !== "abducted") {
      return;
    }
    const falling = freezeInhabitant({
      ...inhabitant,
      x: enemy.x,
      y: enemy.y + 9,
      state: "falling",
      carrierEnemyId: null,
      velocityY: 16,
    });
    inhabitants[index] = falling;
    events.push(
      Object.freeze({
        type: "inhabitant-falling",
        inhabitantId: falling.id,
        position: position(falling),
      }),
    );
  }

  private endIfObjectivesLost(events: StarDefenderSimulationEvent[]): boolean {
    if (
      this.inhabitantState.length > 0 &&
      this.inhabitantState.every((inhabitant) => inhabitant.state === "lost")
    ) {
      this.endRun(events);
      return true;
    }
    return false;
  }

  private endRun(events: StarDefenderSimulationEvent[]): void {
    if (this.gameOverValue) {
      return;
    }
    this.gameOverValue = true;
    this.projectileState = Object.freeze([]);
    events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
  }

  private resolveWaveClear(events: StarDefenderSimulationEvent[]): void {
    if (this.gameOverValue || this.enemyState.length !== 0) {
      return;
    }
    const clearedWave = this.waveValue;
    const bonus = starDefenderWaveClearScore(clearedWave);
    this.scoreValue += bonus;
    this.waveValue += 1;
    this.emergencyChargesValue = Math.min(
      STAR_DEFENDER_RUN_RULES.maxEmergencyCharges,
      this.emergencyChargesValue + 1,
    );
    events.push(
      Object.freeze({
        type: "wave-cleared",
        wave: clearedWave,
        bonus,
        emergencyCharges: this.emergencyChargesValue,
      }),
    );
    this.enemyState = this.createWave(this.waveValue);
  }
}
