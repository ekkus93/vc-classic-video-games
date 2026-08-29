import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  STAR_DEFENDER_RUN_RULES,
  STAR_DEFENDER_SCORING,
  starDefenderWaveClearScore,
  type StarDefenderDifficultyId,
} from "./design.js";
import {
  createStarDefenderWave,
  updateStarDefenderEnemies,
  type StarDefenderEnemy,
} from "./enemies.js";
import {
  createInitialStarDefenderInhabitants,
  resolveStarDefenderFallingCatches,
  updateStarDefenderInhabitants,
  type StarDefenderInhabitant,
} from "./inhabitants.js";
import {
  createStarDefenderPlayer,
  stepStarDefenderPlayer,
  type StarDefenderPlayerState,
} from "./player.js";
import { wrapStarDefenderWorldX, wrappedStarDefenderDistanceSquared } from "./world.js";

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
      readonly enemyType: StarDefenderEnemy["type"];
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

const PROJECTILE_HIT_RADIUS =
  STAR_DEFENDER_RUN_RULES.enemyRadius + STAR_DEFENDER_RUN_RULES.projectileRadius;
const PLAYER_HIT_RADIUS =
  STAR_DEFENDER_RUN_RULES.enemyRadius + STAR_DEFENDER_RUN_RULES.playerRadius;

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

function enemyScore(type: StarDefenderEnemy["type"]): number {
  return STAR_DEFENDER_SCORING[type];
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
  // CR-006/CR2-006: true for the remainder of the update() call in which handleEmergency actually
  // consumed a charge -- not specifically "the wave was cleared by it", despite the name this
  // replaced (emergencyClearedWaveThisUpdate) implying that condition was checked. It isn't:
  // handleEmergency unconditionally empties enemyState whenever it spends a charge, so today
  // "fired" and "cleared the wave" are the same event and this flag is accurate either way. If
  // the burst's own effect ever became partial (a bounded blast radius, off-screen survivors),
  // "fired" and "cleared" would diverge and this flag would need to become the latter -- actually
  // checking that the wave is empty -- rather than silently keeping the former's meaning under a
  // name that now claims otherwise.
  private emergencyFiredThisUpdate = false;
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
        ? createInitialStarDefenderInhabitants(options.rng)
        : options.initialInhabitants.map((entry) => Object.freeze({ ...entry })),
    );
    this.enemyState = Object.freeze(
      options.initialEnemies === undefined
        ? this.createWave(this.waveValue)
        : options.initialEnemies.map((entry) => Object.freeze({ ...entry })),
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
    this.emergencyFiredThisUpdate = false;
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

  private createWave(wave: number): readonly StarDefenderEnemy[] {
    const result = createStarDefenderWave(
      this.options.rng,
      this.options.difficulty,
      wave,
      this.nextEnemyId,
    );
    this.nextEnemyId = result.nextEnemyId;
    return result.enemies;
  }

  private updateInhabitants(
    dtSeconds: number,
    events: StarDefenderSimulationEvent[],
  ): void {
    const result = updateStarDefenderInhabitants(
      this.inhabitantState,
      this.playerState,
      dtSeconds,
      events,
    );
    this.inhabitantState = result.inhabitants;
    this.scoreValue += result.scoreDelta;
  }

  private updateEnemies(
    dtSeconds: number,
    events: StarDefenderSimulationEvent[],
  ): void {
    const inhabitants = [...this.inhabitantState];
    this.enemyState = updateStarDefenderEnemies(
      this.enemyState,
      inhabitants,
      this.playerState,
      this.options.difficulty,
      dtSeconds,
      events,
    );
    this.inhabitantState = Object.freeze(inhabitants);
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
    this.emergencyFiredThisUpdate = true;
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
    const falling = Object.freeze({
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
    const result = resolveStarDefenderFallingCatches(
      this.inhabitantState,
      this.playerState,
      events,
    );
    this.inhabitantState = result.inhabitants;
    this.scoreValue += result.scoreDelta;
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
    const falling = Object.freeze({
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
    if (!this.emergencyFiredThisUpdate) {
      this.emergencyChargesValue = Math.min(
        STAR_DEFENDER_RUN_RULES.maxEmergencyCharges,
        this.emergencyChargesValue + 1,
      );
    }
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
