import type { PointerSnapshot, RandomService, Vector2 } from "../../engine/index.js";
import {
  MISSILE_DEFENSE_DIFFICULTIES,
  MISSILE_DEFENSE_RUN_RULES,
  MISSILE_DEFENSE_SCORING,
  missileDefenseEnemyCount,
  missileDefenseWaveBonus,
  type MissileDefenseDifficultyId,
} from "./design.js";
import { createMissileDefenseCursor, stepMissileDefenseCursor } from "./cursor.js";
import { MissileDefenseEnemyFactory, type MissileDefenseEnemyMissile } from "./enemies.js";
import { MissileDefenseExplosionSystem } from "./explosions.js";
import {
  chooseMissileDefenseBattery,
  consumeBatteryAmmo,
  createMissileDefenseGround,
  destroyGroundTarget,
  prepareGroundForNextWave,
  type MissileDefenseGroundState,
} from "./ground.js";
import { MissileDefenseInterceptorSystem } from "./interceptors.js";

export interface MissileDefenseFrameInput {
  readonly xAxis: -1 | 0 | 1;
  readonly yAxis: -1 | 0 | 1;
  readonly fire: boolean;
  readonly pointer: PointerSnapshot;
}

export type MissileDefenseSimulationEvent =
  | {
      readonly type: "interceptor-fired";
      readonly origin: Vector2;
      readonly target: Vector2;
      readonly batteryId: string;
      readonly ammoRemaining: number;
    }
  | { readonly type: "blast-started"; readonly position: Vector2; readonly chain: boolean }
  | {
      readonly type: "enemy-intercepted";
      readonly position: Vector2;
      readonly points: number;
      readonly chain: boolean;
    }
  | {
      readonly type: "ground-hit";
      readonly position: Vector2;
      readonly targetId: string;
      readonly targetKind: "city" | "battery";
    }
  | {
      readonly type: "wave-cleared";
      readonly wave: number;
      readonly bonus: number;
      readonly survivingCities: number;
      readonly remainingAmmo: number;
    }
  | { readonly type: "game-over"; readonly score: number };

export interface MissileDefenseSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: MissileDefenseDifficultyId;
  readonly initialGround?: MissileDefenseGroundState;
  readonly initialEnemies?: readonly MissileDefenseEnemyMissile[];
  readonly initialWave?: number;
  readonly initialSpawnedCount?: number;
  readonly enemyGoalOverride?: number;
}

const EMPTY_POINTER: PointerSnapshot = Object.freeze({
  position: null,
  inside: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
});

export const MISSILE_DEFENSE_IDLE_INPUT: MissileDefenseFrameInput = Object.freeze({
  xAxis: 0,
  yAxis: 0,
  fire: false,
  pointer: EMPTY_POINTER,
});

export class MissileDefenseSimulation {
  private cursorValue = createMissileDefenseCursor();
  private groundValue: MissileDefenseGroundState;
  private enemiesValue: readonly MissileDefenseEnemyMissile[];
  private readonly interceptors = new MissileDefenseInterceptorSystem();
  private readonly explosions = new MissileDefenseExplosionSystem();
  private readonly enemyFactory: MissileDefenseEnemyFactory;
  private scoreValue = 0;
  private waveValue: number;
  private spawnedThisWave: number;
  private spawnAccumulatorSeconds = 0;
  private waveTransitionSeconds = 0;
  private gameOverValue = false;
  private terminalEventEmitted = false;
  private readonly enemyGoalOverride: number | undefined;

  public constructor(private readonly options: MissileDefenseSimulationOptions) {
    this.groundValue = options.initialGround ?? createMissileDefenseGround();
    this.enemiesValue = Object.freeze([...(options.initialEnemies ?? [])]);
    this.waveValue = options.initialWave ?? 1;
    this.spawnedThisWave = options.initialSpawnedCount ?? this.enemiesValue.length;
    this.enemyGoalOverride = options.enemyGoalOverride;
    if (!Number.isSafeInteger(this.waveValue) || this.waveValue < 1) {
      throw new RangeError("initialWave must be a positive safe integer");
    }
    if (!Number.isSafeInteger(this.spawnedThisWave) || this.spawnedThisWave < 0) {
      throw new RangeError("initialSpawnedCount must be a non-negative safe integer");
    }
    this.enemyFactory = new MissileDefenseEnemyFactory(options.rng, options.difficulty);
  }

  public get cursor(): Vector2 {
    return this.cursorValue;
  }

  public get ground(): MissileDefenseGroundState {
    return this.groundValue;
  }

  public get enemies(): readonly MissileDefenseEnemyMissile[] {
    return this.enemiesValue;
  }

  public get activeInterceptors() {
    return this.interceptors.active;
  }

  public get activeExplosions() {
    return this.explosions.explosions;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get wave(): number {
    return this.waveValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public update(
    input: MissileDefenseFrameInput,
    dtSeconds: number,
  ): readonly MissileDefenseSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: MissileDefenseSimulationEvent[] = [];
    this.cursorValue = stepMissileDefenseCursor(this.cursorValue, input, dtSeconds);

    if (this.waveTransitionSeconds > 0) {
      this.waveTransitionSeconds = Math.max(0, this.waveTransitionSeconds - dtSeconds);
      this.explosions.update(dtSeconds);
      if (this.waveTransitionSeconds === 0) {
        this.startNextWave();
      }
      return Object.freeze(events);
    }

    if (input.fire) {
      this.tryFire(events);
    }

    const interceptorStep = this.interceptors.update(dtSeconds);
    for (const position of interceptorStep.arrived) {
      if (this.explosions.trySpawn(position, false)) {
        events.push(Object.freeze({ type: "blast-started", position, chain: false }));
      }
    }
    this.explosions.update(dtSeconds);

    this.spawnEnemies(dtSeconds);
    const enemyStep = this.enemyFactory.update(this.enemiesValue, dtSeconds);
    this.enemiesValue = enemyStep.active;

    this.resolveBlastHits(events);
    this.resolveGroundImpacts(enemyStep.impacts, events);

    if (this.groundValue.cities.every((city) => !city.alive)) {
      this.finishGame(events);
      return Object.freeze(events);
    }

    this.resolveWave(events);
    return Object.freeze(events);
  }

  private tryFire(events: MissileDefenseSimulationEvent[]): void {
    const battery = chooseMissileDefenseBattery(this.groundValue.batteries, this.cursorValue);
    if (battery === null) {
      return;
    }
    if (!this.interceptors.tryLaunch(battery.position, this.cursorValue)) {
      return;
    }
    this.groundValue = consumeBatteryAmmo(this.groundValue, battery.id);
    const updated = this.groundValue.batteries.find((entry) => entry.id === battery.id);
    events.push(
      Object.freeze({
        type: "interceptor-fired",
        origin: battery.position,
        target: this.cursorValue,
        batteryId: battery.id,
        ammoRemaining: updated?.ammo ?? 0,
      }),
    );
  }

  private spawnEnemies(dtSeconds: number): void {
    const goal = this.enemyGoal();
    if (this.spawnedThisWave >= goal || this.enemiesValue.length >= MISSILE_DEFENSE_RUN_RULES.maxEnemyMissiles) {
      return;
    }
    this.spawnAccumulatorSeconds += dtSeconds;
    const interval = MISSILE_DEFENSE_DIFFICULTIES[this.options.difficulty].spawnIntervalSeconds;
    const next = [...this.enemiesValue];
    while (
      this.spawnAccumulatorSeconds >= interval &&
      this.spawnedThisWave < goal &&
      next.length < MISSILE_DEFENSE_RUN_RULES.maxEnemyMissiles
    ) {
      this.spawnAccumulatorSeconds -= interval;
      next.push(this.enemyFactory.create(this.groundValue, this.waveValue));
      this.spawnedThisWave += 1;
    }
    this.enemiesValue = Object.freeze(next);
  }

  private resolveBlastHits(events: MissileDefenseSimulationEvent[]): void {
    const survivors: MissileDefenseEnemyMissile[] = [];
    for (const missile of this.enemiesValue) {
      if (!this.explosions.contains(missile.position)) {
        survivors.push(missile);
        continue;
      }
      const chain = this.explosions.trySpawn(missile.position, true);
      const points = chain
        ? MISSILE_DEFENSE_SCORING.chainMissile
        : MISSILE_DEFENSE_SCORING.interceptedMissile;
      this.scoreValue += points;
      events.push(
        Object.freeze({
          type: "enemy-intercepted",
          position: missile.position,
          points,
          chain,
        }),
      );
      if (chain) {
        events.push(
          Object.freeze({ type: "blast-started", position: missile.position, chain: true }),
        );
      }
    }
    this.enemiesValue = Object.freeze(survivors);
  }

  private resolveGroundImpacts(
    impacts: readonly MissileDefenseEnemyMissile[],
    events: MissileDefenseSimulationEvent[],
  ): void {
    for (const missile of impacts) {
      const city = this.groundValue.cities.find((entry) => entry.id === missile.targetId);
      const battery = this.groundValue.batteries.find((entry) => entry.id === missile.targetId);
      const live = city?.alive === true || battery?.alive === true;
      if (!live) {
        continue;
      }
      this.groundValue = destroyGroundTarget(this.groundValue, missile.targetId);
      const targetKind = city !== undefined ? "city" : "battery";
      events.push(
        Object.freeze({
          type: "ground-hit",
          position: missile.target,
          targetId: missile.targetId,
          targetKind,
        }),
      );
      if (this.explosions.trySpawn(missile.target, true)) {
        events.push(
          Object.freeze({ type: "blast-started", position: missile.target, chain: true }),
        );
      }
    }
  }

  private resolveWave(events: MissileDefenseSimulationEvent[]): void {
    if (
      this.spawnedThisWave < this.enemyGoal() ||
      this.enemiesValue.length > 0 ||
      this.interceptors.active.length > 0 ||
      this.explosions.explosions.length > 0
    ) {
      return;
    }
    const survivingCities = this.groundValue.cities.filter((city) => city.alive).length;
    const remainingAmmo = this.groundValue.batteries.reduce(
      (sum, battery) => sum + battery.ammo,
      0,
    );
    const bonus =
      missileDefenseWaveBonus(this.waveValue) +
      survivingCities * MISSILE_DEFENSE_SCORING.survivingCity +
      remainingAmmo * MISSILE_DEFENSE_SCORING.remainingAmmo;
    this.scoreValue += bonus;
    events.push(
      Object.freeze({
        type: "wave-cleared",
        wave: this.waveValue,
        bonus,
        survivingCities,
        remainingAmmo,
      }),
    );
    this.waveTransitionSeconds = MISSILE_DEFENSE_RUN_RULES.waveTransitionSeconds;
  }

  private startNextWave(): void {
    this.waveValue += 1;
    this.spawnedThisWave = 0;
    this.spawnAccumulatorSeconds = 0;
    this.groundValue = prepareGroundForNextWave(this.groundValue);
    this.interceptors.reset();
    this.explosions.reset();
  }

  private enemyGoal(): number {
    return this.enemyGoalOverride ?? missileDefenseEnemyCount(this.options.difficulty, this.waveValue);
  }

  private finishGame(events: MissileDefenseSimulationEvent[]): void {
    this.gameOverValue = true;
    this.interceptors.reset();
    if (!this.terminalEventEmitted) {
      this.terminalEventEmitted = true;
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
    }
  }
}
