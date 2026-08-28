import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  SKY_RIDERS_DIFFICULTIES,
  SKY_RIDERS_PLATFORMS,
  SKY_RIDERS_RUN_RULES,
  SKY_RIDERS_SCORING,
  skyRidersEnemyCount,
  skyRidersEnemyScore,
  skyRidersWaveClearScore,
  type SkyRidersDifficultyId,
  type SkyRidersPlatform,
} from "./design.js";
import {
  bounceRiderFromTie,
  createSkyRider,
  resolveAltitudeCombat,
  riderOverlap,
  stepSkyRider,
  type SkyRidersRiderInput,
  type SkyRidersRiderState,
} from "./physics.js";

export interface SkyRidersPlayerInput extends SkyRidersRiderInput { readonly player: 1 | 2; }
export interface SkyRidersPlayerState { readonly player: 1 | 2; readonly rider: SkyRidersRiderState; readonly lives: number; readonly active: boolean; }
export interface SkyRidersEnemyState { readonly rider: SkyRidersRiderState; readonly decisionSeconds: number; }
export interface SkyRidersStormSeed { readonly id: number; readonly position: Vector2; readonly velocityY: number; readonly remainingSeconds: number; }
export type SkyRidersSimulationEvent =
  | { readonly type: "flap"; readonly rider: "player" | "enemy"; readonly position: Vector2 }
  | { readonly type: "combat-clash"; readonly position: Vector2 }
  | { readonly type: "enemy-defeated"; readonly points: number; readonly position: Vector2 }
  | { readonly type: "player-hit"; readonly player: 1 | 2; readonly livesRemaining: number; readonly position: Vector2 }
  | { readonly type: "storm-seed-collected"; readonly player: 1 | 2; readonly points: number; readonly position: Vector2 }
  | { readonly type: "storm-seed-reformed"; readonly position: Vector2 }
  | { readonly type: "wave-cleared"; readonly wave: number; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };
export interface SkyRidersSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: SkyRidersDifficultyId;
  readonly players: 1 | 2;
  readonly initialPlayerStates?: readonly SkyRidersPlayerState[];
  readonly initialEnemies?: readonly SkyRidersEnemyState[];
  readonly initialStormSeeds?: readonly SkyRidersStormSeed[];
  readonly initialWave?: number;
}

const PLAYER_SPAWNS = Object.freeze({ 1: Object.freeze({ x: 82, y: 68 }), 2: Object.freeze({ x: 238, y: 68 }) });
const ENEMY_SPAWNS = Object.freeze([
  Object.freeze({ x: 54, y: 128 }), Object.freeze({ x: 266, y: 120 }),
  Object.freeze({ x: 160, y: 58 }), Object.freeze({ x: 128, y: 188 }),
  Object.freeze({ x: 218, y: 190 }), Object.freeze({ x: 92, y: 54 }),
  Object.freeze({ x: 286, y: 72 }), Object.freeze({ x: 34, y: 76 }),
]);
function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive safe integer`);
}
function wrappedHorizontalDelta(fromX: number, toX: number): number {
  const width = SKY_RIDERS_RUN_RULES.logicalWidth;
  let delta = toX - fromX;
  if (delta > width / 2) delta -= width;
  else if (delta < -width / 2) delta += width;
  return delta;
}
function horizontalDirection(delta: number): -1 | 0 | 1 { return Math.abs(delta) < 3 ? 0 : delta < 0 ? -1 : 1; }
function stormSeedLandingPlatform(
  seed: SkyRidersStormSeed,
  nextY: number,
  nextVelocityY: number,
  platforms: readonly SkyRidersPlatform[],
): SkyRidersPlatform | null {
  if (nextVelocityY < 0) return null;
  const previousBottom = seed.position.y + SKY_RIDERS_RUN_RULES.stormSeedRadius;
  const nextBottom = nextY + SKY_RIDERS_RUN_RULES.stormSeedRadius;
  let best: SkyRidersPlatform | null = null;
  for (const platform of platforms) {
    const withinX = seed.position.x + SKY_RIDERS_RUN_RULES.stormSeedRadius >= platform.x && seed.position.x - SKY_RIDERS_RUN_RULES.stormSeedRadius <= platform.x + platform.width;
    if (!withinX || previousBottom > platform.y + 0.001 || nextBottom < platform.y) continue;
    if (best === null || platform.y < best.y) best = platform;
  }
  return best;
}
function stormSeedTouchesRider(seed: SkyRidersStormSeed, rider: SkyRidersRiderState): boolean {
  const dxRaw = Math.abs(seed.position.x - rider.position.x);
  const dx = Math.min(dxRaw, SKY_RIDERS_RUN_RULES.logicalWidth - dxRaw);
  return dx <= SKY_RIDERS_RUN_RULES.riderHalfWidth + SKY_RIDERS_RUN_RULES.stormSeedRadius && Math.abs(seed.position.y - rider.position.y) <= SKY_RIDERS_RUN_RULES.riderHalfHeight + SKY_RIDERS_RUN_RULES.stormSeedRadius;
}

export class SkyRidersSimulation {
  private playerState: readonly SkyRidersPlayerState[];
  private enemyState: readonly SkyRidersEnemyState[];
  private stormSeedState: readonly SkyRidersStormSeed[];
  private scoreValue = 0;
  private waveValue: number;
  private gameOverValue = false;
  private nextRiderId = 100;
  private nextStormSeedId = 1;

  public constructor(private readonly options: SkyRidersSimulationOptions) {
    if (options.players !== 1 && options.players !== 2) throw new RangeError("Sky Riders supports one or two players");
    this.waveValue = options.initialWave ?? 1;
    requirePositiveInteger(this.waveValue, "initialWave");
    this.playerState = Object.freeze(options.initialPlayerStates === undefined ? this.createPlayers(options.players) : [...options.initialPlayerStates]);
    if (this.playerState.length !== options.players) throw new RangeError("initialPlayerStates must match configured players");
    for (const player of this.playerState) requirePositiveInteger(player.lives, "player lives");
    this.enemyState = Object.freeze(options.initialEnemies === undefined ? this.createWaveEnemies(this.waveValue) : [...options.initialEnemies]);
    this.stormSeedState = Object.freeze(options.initialStormSeeds === undefined ? [] : [...options.initialStormSeeds]);
    if (this.enemyState.length + this.stormSeedState.length > SKY_RIDERS_RUN_RULES.maxEnemies) throw new RangeError("initial opponent population exceeds hard cap");
    const riderIds = [...this.playerState.map((p) => p.rider.id), ...this.enemyState.map((e) => e.rider.id)];
    this.nextRiderId = Math.max(this.nextRiderId, ...riderIds) + 1;
    this.nextStormSeedId = Math.max(0, ...this.stormSeedState.map((seed) => seed.id)) + 1;
  }
  public get players(): readonly SkyRidersPlayerState[] { return this.playerState; }
  public get enemies(): readonly SkyRidersEnemyState[] { return this.enemyState; }
  public get stormSeeds(): readonly SkyRidersStormSeed[] { return this.stormSeedState; }
  public get score(): number { return this.scoreValue; }
  public get wave(): number { return this.waveValue; }
  public get gameOver(): boolean { return this.gameOverValue; }

  public update(inputs: readonly SkyRidersPlayerInput[], dtSeconds: number): readonly SkyRidersSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError("dtSeconds must be a non-negative finite number");
    if (this.gameOverValue) return Object.freeze([]);
    const events: SkyRidersSimulationEvent[] = [];
    this.stepPlayers(inputs, dtSeconds, events);
    this.stepEnemies(dtSeconds, events);
    this.stepStormSeeds(dtSeconds, events);
    this.resolveCombat(events);
    this.resolveTerminalState(events);
    this.resolveWaveClear(events);
    return Object.freeze(events);
  }

  private createPlayers(players: 1 | 2): readonly SkyRidersPlayerState[] {
    return Object.freeze(([1, 2] as const).slice(0, players).map((player) => Object.freeze({
      player,
      rider: createSkyRider(player, PLAYER_SPAWNS[player], player === 1 ? 1 : -1, SKY_RIDERS_RUN_RULES.spawnProtectionSeconds),
      lives: SKY_RIDERS_RUN_RULES.startingLives,
      active: true,
    })));
  }
  private createWaveEnemies(wave: number): readonly SkyRidersEnemyState[] {
    return Object.freeze(Array.from({ length: skyRidersEnemyCount(this.options.difficulty, wave) }, (_, index) => this.createEnemy(index)));
  }
  private createEnemy(spawnOffset = 0, position?: Vector2): SkyRidersEnemyState {
    const spawnIndex = (spawnOffset + Math.floor(this.options.rng.nextFloat() * ENEMY_SPAWNS.length)) % ENEMY_SPAWNS.length;
    const spawn = position ?? ENEMY_SPAWNS[spawnIndex];
    if (spawn === undefined) throw new Error("Sky Riders enemy spawn table is empty");
    const id = this.nextRiderId++;
    return Object.freeze({
      rider: createSkyRider(id, spawn, this.options.rng.nextFloat() < 0.5 ? -1 : 1, 0.35),
      decisionSeconds: 0.08 + this.options.rng.nextFloat() * 0.28,
    });
  }
  private stepPlayers(inputs: readonly SkyRidersPlayerInput[], dt: number, events: SkyRidersSimulationEvent[]): void {
    const byPlayer = new Map(inputs.map((input) => [input.player, input] as const));
    this.playerState = Object.freeze(this.playerState.map((player) => {
      if (!player.active) return player;
      const input = byPlayer.get(player.player) ?? { player: player.player, horizontal: 0 as const, flap: false };
      const step = stepSkyRider(player.rider, input, dt, { maxHorizontalSpeed: SKY_RIDERS_RUN_RULES.playerMaxHorizontalSpeed });
      if (step.flapped) events.push(Object.freeze({ type: "flap", rider: "player", position: step.rider.position }));
      return Object.freeze({ ...player, rider: step.rider });
    }));
  }
  private stepEnemies(dt: number, events: SkyRidersSimulationEvent[]): void {
    const activePlayers = this.playerState.filter((p) => p.active);
    if (activePlayers.length === 0) return;
    const difficulty = SKY_RIDERS_DIFFICULTIES[this.options.difficulty];
    this.enemyState = Object.freeze(this.enemyState.map((enemy) => {
      let target = activePlayers[0];
      if (target === undefined) return enemy;
      let bestDistance = Math.abs(wrappedHorizontalDelta(enemy.rider.position.x, target.rider.position.x));
      for (const candidate of activePlayers.slice(1)) {
        const distance = Math.abs(wrappedHorizontalDelta(enemy.rider.position.x, candidate.rider.position.x));
        if (distance < bestDistance) { target = candidate; bestDistance = distance; }
      }
      let decisionSeconds = enemy.decisionSeconds - dt;
      let flap = false;
      if (decisionSeconds <= 0) {
        flap = target.rider.position.y < enemy.rider.position.y - 8 || enemy.rider.position.y > 194 || this.options.rng.nextFloat() < 0.18;
        decisionSeconds = 0.2 + this.options.rng.nextFloat() * 0.3;
      }
      const input: SkyRidersRiderInput = Object.freeze({ horizontal: horizontalDirection(wrappedHorizontalDelta(enemy.rider.position.x, target.rider.position.x)), flap });
      const step = stepSkyRider(enemy.rider, input, dt, {
        maxHorizontalSpeed: SKY_RIDERS_RUN_RULES.enemyMaxHorizontalSpeed * difficulty.enemySpeedScale,
        horizontalAccelerationScale: difficulty.enemySpeedScale,
      });
      if (step.flapped) events.push(Object.freeze({ type: "flap", rider: "enemy", position: step.rider.position }));
      return Object.freeze({ rider: step.rider, decisionSeconds });
    }));
  }
  private stepStormSeeds(dt: number, events: SkyRidersSimulationEvent[]): void {
    const survivors: SkyRidersStormSeed[] = [];
    const reformed: SkyRidersEnemyState[] = [];
    for (const seed of this.stormSeedState) {
      let velocityY = Math.min(SKY_RIDERS_RUN_RULES.stormSeedMaxFallSpeed, seed.velocityY + SKY_RIDERS_RUN_RULES.stormSeedGravity * dt);
      let nextY = seed.position.y + velocityY * dt;
      const platform = stormSeedLandingPlatform(seed, nextY, velocityY, SKY_RIDERS_PLATFORMS);
      if (platform !== null) { nextY = platform.y - SKY_RIDERS_RUN_RULES.stormSeedRadius; velocityY = 0; }
      const stepped = Object.freeze({ ...seed, position: Object.freeze({ x: seed.position.x, y: nextY }), velocityY, remainingSeconds: Math.max(0, seed.remainingSeconds - dt) });
      const collector = this.playerState.find((p) => p.active && stormSeedTouchesRider(stepped, p.rider));
      if (collector !== undefined) {
        this.scoreValue += SKY_RIDERS_SCORING.recovery;
        events.push(Object.freeze({ type: "storm-seed-collected", player: collector.player, points: SKY_RIDERS_SCORING.recovery, position: stepped.position }));
        continue;
      }
      if (stepped.remainingSeconds <= 0) {
        reformed.push(this.createEnemy(0, { x: stepped.position.x, y: Math.max(20, stepped.position.y - 18) }));
        events.push(Object.freeze({ type: "storm-seed-reformed", position: stepped.position }));
        continue;
      }
      survivors.push(stepped);
    }
    this.stormSeedState = Object.freeze(survivors);
    if (reformed.length > 0) this.enemyState = Object.freeze([...this.enemyState, ...reformed]);
  }
  private resolveCombat(events: SkyRidersSimulationEvent[]): void {
    const players = [...this.playerState];
    const enemies = [...this.enemyState];
    const defeated = new Set<number>();
    for (let pi = 0; pi < players.length; pi += 1) {
      let player = players[pi];
      if (player === undefined || !player.active) continue;
      for (let ei = 0; ei < enemies.length; ei += 1) {
        let enemy = enemies[ei];
        if (enemy === undefined || defeated.has(enemy.rider.id) || player.rider.invulnerabilitySeconds > 0 || enemy.rider.invulnerabilitySeconds > 0 || !riderOverlap(player.rider, enemy.rider)) continue;
        const outcome = resolveAltitudeCombat(player.rider, enemy.rider);
        if (outcome === "first") {
          defeated.add(enemy.rider.id);
          const points = skyRidersEnemyScore(this.waveValue);
          this.scoreValue += points;
          this.stormSeedState = Object.freeze([...this.stormSeedState, Object.freeze({ id: this.nextStormSeedId++, position: enemy.rider.position, velocityY: -18, remainingSeconds: SKY_RIDERS_RUN_RULES.stormSeedLifetimeSeconds })]);
          events.push(Object.freeze({ type: "enemy-defeated", points, position: enemy.rider.position }));
          break;
        }
        if (outcome === "second") {
          const collisionPosition = player.rider.position;
          const lives = player.lives - 1;
          player = lives <= 0 ? Object.freeze({ ...player, lives: 0, active: false }) : Object.freeze({ ...player, lives, rider: createSkyRider(player.rider.id, PLAYER_SPAWNS[player.player], player.player === 1 ? 1 : -1, SKY_RIDERS_RUN_RULES.spawnProtectionSeconds) });
          players[pi] = player;
          events.push(Object.freeze({ type: "player-hit", player: player.player, livesRemaining: player.lives, position: collisionPosition }));
          break;
        }
        const playerDirection: -1 | 1 = wrappedHorizontalDelta(enemy.rider.position.x, player.rider.position.x) < 0 ? -1 : 1;
        player = Object.freeze({ ...player, rider: bounceRiderFromTie(player.rider, playerDirection) });
        enemy = Object.freeze({ ...enemy, rider: bounceRiderFromTie(enemy.rider, playerDirection === 1 ? -1 : 1) });
        players[pi] = player; enemies[ei] = enemy;
        events.push(Object.freeze({ type: "combat-clash", position: player.rider.position }));
        break;
      }
    }
    this.playerState = Object.freeze(players);
    this.enemyState = Object.freeze(enemies.filter((enemy) => !defeated.has(enemy.rider.id)));
  }
  private resolveTerminalState(events: SkyRidersSimulationEvent[]): void {
    if (this.playerState.some((p) => p.active)) return;
    this.gameOverValue = true;
    events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
  }
  private resolveWaveClear(events: SkyRidersSimulationEvent[]): void {
    if (this.gameOverValue || this.enemyState.length !== 0 || this.stormSeedState.length !== 0) return;
    const clearedWave = this.waveValue;
    const bonus = skyRidersWaveClearScore(clearedWave);
    this.scoreValue += bonus;
    events.push(Object.freeze({ type: "wave-cleared", wave: clearedWave, bonus }));
    this.waveValue += 1;
    this.enemyState = this.createWaveEnemies(this.waveValue);
  }
}
