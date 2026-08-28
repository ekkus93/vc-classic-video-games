import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  createBugBarrageChain,
  splitBugBarrageChain,
  stepBugBarrageChain,
  type BugBarrageChain,
  type BugBarrageSegment,
} from "./chains.js";
import {
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
  BUG_BARRAGE_SCORING,
  bugBarrageRoamerInterval,
  bugBarrageSegmentSpeed,
  bugBarrageWaveClearScore,
  bugBarrageWaveObstacleCount,
  bugBarrageWaveSegmentCount,
  type BugBarrageDifficultyId,
} from "./design.js";
import {
  addBugBarrageObstacle,
  createBugBarrageField,
  damageBugBarrageObstacle,
  nearestDamagedObstacle,
  repairBugBarrageObstacle,
  type BugBarrageObstacle,
} from "./field.js";
import {
  BugBarrageProjectileSystem,
  sweptPointHitsCircle,
} from "./projectiles.js";
import {
  spawnBugBarrageRoamer,
  stepBugBarrageRoamer,
  type BugBarrageRoamer,
} from "./roamers.js";

export interface BugBarrageFrameInput {
  readonly horizontal: -1 | 0 | 1;
  readonly vertical: -1 | 0 | 1;
  readonly fire: boolean;
}

export type BugBarrageSimulationEvent =
  | { readonly type: "spark-fired"; readonly position: Vector2 }
  | {
      readonly type: "segment-destroyed";
      readonly position: Vector2;
      readonly points: number;
      readonly chainCount: number;
    }
  | {
      readonly type: "pod-damaged";
      readonly position: Vector2;
      readonly destroyed: boolean;
      readonly points: number;
    }
  | { readonly type: "pod-repaired"; readonly position: Vector2 }
  | {
      readonly type: "roamer-destroyed";
      readonly position: Vector2;
      readonly kind: BugBarrageRoamer["kind"];
      readonly points: number;
    }
  | {
      readonly type: "player-hit";
      readonly position: Vector2;
      readonly livesRemaining: number;
    }
  | { readonly type: "wave-cleared"; readonly wave: number; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };

export interface BugBarrageSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: BugBarrageDifficultyId;
  readonly initialObstacles?: readonly BugBarrageObstacle[];
  readonly initialChains?: readonly BugBarrageChain[];
  readonly initialRoamers?: readonly BugBarrageRoamer[];
  readonly initialLives?: number;
  readonly initialPlayerPosition?: Vector2;
  readonly initialInvulnerabilitySeconds?: number;
}

export class BugBarrageSimulation {
  private playerPositionValue: Vector2;
  private obstaclesValue: readonly BugBarrageObstacle[];
  private chainsValue: readonly BugBarrageChain[];
  private roamersValue: readonly BugBarrageRoamer[];
  private readonly projectiles = new BugBarrageProjectileSystem();
  private livesValue: number;
  private scoreValue = 0;
  private waveValue = 1;
  private invulnerabilityValue: number;
  private gameOverValue = false;
  private nextObstacleId = 1;
  private nextChainId = 1;
  private nextSegmentId = 1;
  private nextRoamerId = 1;
  private roamerSpawnSeconds: number;

  public constructor(private readonly options: BugBarrageSimulationOptions) {
    this.playerPositionValue = Object.freeze({
      ...(options.initialPlayerPosition ?? this.respawnPosition()),
    });
    this.obstaclesValue = Object.freeze(
      options.initialObstacles === undefined
        ? [...this.createWaveField()]
        : [...options.initialObstacles],
    );
    this.updateNextObstacleId();
    this.chainsValue = Object.freeze(
      options.initialChains === undefined
        ? [this.createWaveChain()]
        : [...options.initialChains],
    );
    this.updateNextChainAndSegmentIds();
    this.roamersValue = Object.freeze([...(options.initialRoamers ?? [])]);
    this.updateNextRoamerId();
    this.livesValue = options.initialLives ?? BUG_BARRAGE_RUN_RULES.startingLives;
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue <= 0) {
      throw new RangeError("initialLives must be a positive safe integer");
    }
    this.invulnerabilityValue = options.initialInvulnerabilitySeconds ?? 0.8;
    if (!Number.isFinite(this.invulnerabilityValue) || this.invulnerabilityValue < 0) {
      throw new RangeError(
        "initialInvulnerabilitySeconds must be non-negative and finite",
      );
    }
    this.roamerSpawnSeconds = bugBarrageRoamerInterval(
      this.waveValue,
      options.difficulty,
    );
  }

  public get playerPosition(): Vector2 {
    return this.playerPositionValue;
  }

  public get obstacles(): readonly BugBarrageObstacle[] {
    return this.obstaclesValue;
  }

  public get chains(): readonly BugBarrageChain[] {
    return this.chainsValue;
  }

  public get roamers(): readonly BugBarrageRoamer[] {
    return this.roamersValue;
  }

  public get sparks() {
    return this.projectiles.projectiles;
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

  public get segmentCount(): number {
    return this.chainsValue.reduce((count, chain) => count + chain.segments.length, 0);
  }

  public update(
    input: BugBarrageFrameInput,
    dtSeconds: number,
  ): readonly BugBarrageSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: BugBarrageSimulationEvent[] = [];
    this.movePlayer(input, dtSeconds);
    if (input.fire) {
      const projectile = this.projectiles.tryFire(this.playerPositionValue);
      if (projectile !== null) {
        events.push(
          Object.freeze({ type: "spark-fired", position: projectile.position }),
        );
      }
    }
    this.projectiles.update(dtSeconds);

    const segmentSpeed = bugBarrageSegmentSpeed(
      this.waveValue,
      this.options.difficulty,
    );
    this.chainsValue = Object.freeze(
      this.chainsValue.map((chain) =>
        stepBugBarrageChain(chain, this.obstaclesValue, segmentSpeed, dtSeconds),
      ),
    );
    this.roamersValue = Object.freeze(
      this.roamersValue
        .map((roamer) => stepBugBarrageRoamer(roamer, dtSeconds))
        .filter((roamer): roamer is BugBarrageRoamer => roamer !== null),
    );
    this.invulnerabilityValue = Math.max(0, this.invulnerabilityValue - dtSeconds);

    this.spawnRoamer(dtSeconds);
    this.applyMenderRepairs(events);
    this.resolveProjectileHits(events);
    this.resolvePlayerHit(events);
    this.resolveWaveClear(events);
    this.assertBounds();

    return Object.freeze(events);
  }

  private movePlayer(input: BugBarrageFrameInput, dtSeconds: number): void {
    const magnitude = Math.hypot(input.horizontal, input.vertical);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const x =
      this.playerPositionValue.x +
      input.horizontal * BUG_BARRAGE_RUN_RULES.playerSpeed * scale * dtSeconds;
    const y =
      this.playerPositionValue.y +
      input.vertical * BUG_BARRAGE_RUN_RULES.playerSpeed * scale * dtSeconds;
    const radius = BUG_BARRAGE_RUN_RULES.playerRadius;
    this.playerPositionValue = Object.freeze({
      x: Math.max(radius + 2, Math.min(BUG_BARRAGE_RUN_RULES.logicalWidth - radius - 2, x)),
      y: Math.max(
        BUG_BARRAGE_RUN_RULES.playerRegionTop + radius,
        Math.min(BUG_BARRAGE_RUN_RULES.playerRegionBottom - radius, y),
      ),
    });
  }

  private spawnRoamer(dtSeconds: number): void {
    this.roamerSpawnSeconds -= dtSeconds;
    if (this.roamerSpawnSeconds > 0) {
      return;
    }
    this.roamerSpawnSeconds += bugBarrageRoamerInterval(
      this.waveValue,
      this.options.difficulty,
    );
    const roamer = spawnBugBarrageRoamer(
      this.options.rng,
      this.nextRoamerId,
      this.roamersValue.length,
      this.waveValue,
    );
    if (roamer !== null) {
      this.nextRoamerId += 1;
      this.roamersValue = Object.freeze([...this.roamersValue, roamer]);
    }
  }

  private applyMenderRepairs(events: BugBarrageSimulationEvent[]): void {
    this.roamersValue = Object.freeze(
      this.roamersValue.map((roamer) => {
        if (roamer.kind !== "mender" || roamer.repairCooldownSeconds > 0) {
          return roamer;
        }
        const damaged = nearestDamagedObstacle(
          this.obstaclesValue,
          roamer.position,
          12,
        );
        if (damaged === null) {
          return roamer;
        }
        this.obstaclesValue = repairBugBarrageObstacle(
          this.obstaclesValue,
          damaged.id,
        );
        events.push(
          Object.freeze({ type: "pod-repaired", position: damaged.position }),
        );
        return Object.freeze({ ...roamer, repairCooldownSeconds: 0.65 });
      }),
    );
  }

  private resolveProjectileHits(events: BugBarrageSimulationEvent[]): void {
    for (const projectile of [...this.projectiles.projectiles]) {
      const roamerIndex = this.roamersValue.findIndex((roamer) =>
        sweptPointHitsCircle(
          projectile.previousPosition,
          projectile.position,
          roamer.position,
          8 + BUG_BARRAGE_RUN_RULES.projectileRadius,
        ),
      );
      if (roamerIndex >= 0) {
        const roamer = this.roamersValue[roamerIndex];
        if (roamer !== undefined) {
          const points =
            roamer.kind === "skimmer"
              ? BUG_BARRAGE_SCORING.skimmer
              : BUG_BARRAGE_SCORING.mender;
          this.scoreValue += points;
          this.roamersValue = Object.freeze(
            this.roamersValue.filter((_, index) => index !== roamerIndex),
          );
          this.projectiles.remove(projectile.id);
          events.push(
            Object.freeze({
              type: "roamer-destroyed",
              position: roamer.position,
              kind: roamer.kind,
              points,
            }),
          );
          continue;
        }
      }

      const segmentHit = this.findSegmentHit(projectile);
      if (segmentHit !== null) {
        this.destroySegment(segmentHit.chain, segmentHit.segment, events);
        this.projectiles.remove(projectile.id);
        continue;
      }

      const obstacle = this.obstaclesValue.find((candidate) =>
        sweptPointHitsCircle(
          projectile.previousPosition,
          projectile.position,
          candidate.position,
          BUG_BARRAGE_RUN_RULES.obstacleRadius +
            BUG_BARRAGE_RUN_RULES.projectileRadius,
        ),
      );
      if (obstacle === undefined) {
        continue;
      }
      const result = damageBugBarrageObstacle(this.obstaclesValue, obstacle.id);
      this.obstaclesValue = result.obstacles;
      const points = result.destroyed
        ? BUG_BARRAGE_SCORING.obstacleDestroyed
        : BUG_BARRAGE_SCORING.obstacleHit;
      this.scoreValue += points;
      this.projectiles.remove(projectile.id);
      events.push(
        Object.freeze({
          type: "pod-damaged",
          position: obstacle.position,
          destroyed: result.destroyed,
          points,
        }),
      );
    }
  }

  private findSegmentHit(projectile: {
    readonly previousPosition: Vector2;
    readonly position: Vector2;
  }): { readonly chain: BugBarrageChain; readonly segment: BugBarrageSegment } | null {
    for (const chain of this.chainsValue) {
      for (const segment of chain.segments) {
        if (
          sweptPointHitsCircle(
            projectile.previousPosition,
            projectile.position,
            segment.position,
            BUG_BARRAGE_RUN_RULES.segmentRadius +
              BUG_BARRAGE_RUN_RULES.projectileRadius,
          )
        ) {
          return Object.freeze({ chain, segment });
        }
      }
    }
    return null;
  }

  private destroySegment(
    chain: BugBarrageChain,
    segment: BugBarrageSegment,
    events: BugBarrageSimulationEvent[],
  ): void {
    const hitIndex = chain.segments.findIndex((candidate) => candidate.id === segment.id);
    const points =
      hitIndex === 0 ? BUG_BARRAGE_SCORING.headSegment : BUG_BARRAGE_SCORING.segment;
    this.scoreValue += points;

    const withoutHit = this.chainsValue.filter((candidate) => candidate.id !== chain.id);
    let replacements: readonly BugBarrageChain[];
    if (withoutHit.length + 2 <= BUG_BARRAGE_LIMITS.maxChains) {
      replacements = splitBugBarrageChain(chain, segment.id, this.nextChainId);
      this.nextChainId += replacements.length;
    } else {
      const survivors = chain.segments.filter((candidate) => candidate.id !== segment.id);
      replacements =
        survivors.length === 0
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({
                id: chain.id,
                segments: Object.freeze([...survivors]),
              }),
            ]);
    }
    this.chainsValue = Object.freeze([...withoutHit, ...replacements]);

    this.obstaclesValue = addBugBarrageObstacle(
      this.obstaclesValue,
      Object.freeze({
        id: this.nextObstacleId,
        position: Object.freeze({
          x: Math.round(segment.position.x),
          y: Math.round(segment.position.y),
        }),
        health: BUG_BARRAGE_RUN_RULES.maxObstacleHealth,
      }),
    );
    this.nextObstacleId += 1;
    events.push(
      Object.freeze({
        type: "segment-destroyed",
        position: segment.position,
        points,
        chainCount: this.chainsValue.length,
      }),
    );
  }

  private resolvePlayerHit(events: BugBarrageSimulationEvent[]): void {
    if (this.invulnerabilityValue > 0) {
      return;
    }
    const playerRadius = BUG_BARRAGE_RUN_RULES.playerRadius;
    const hitSegment = this.chainsValue.some((chain) =>
      chain.segments.some(
        (segment) =>
          distanceSquared(segment.position, this.playerPositionValue) <=
          (BUG_BARRAGE_RUN_RULES.segmentRadius + playerRadius) ** 2,
      ),
    );
    const hitRoamer = this.roamersValue.some(
      (roamer) =>
        distanceSquared(roamer.position, this.playerPositionValue) <=
        (7 + playerRadius) ** 2,
    );
    if (!hitSegment && !hitRoamer) {
      return;
    }

    const hitPosition = this.playerPositionValue;
    this.livesValue -= 1;
    events.push(
      Object.freeze({
        type: "player-hit",
        position: hitPosition,
        livesRemaining: this.livesValue,
      }),
    );
    this.projectiles.reset();
    if (this.livesValue <= 0) {
      this.gameOverValue = true;
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      return;
    }
    this.playerPositionValue = this.respawnPosition();
    this.invulnerabilityValue = BUG_BARRAGE_RUN_RULES.respawnProtectionSeconds;
  }

  private resolveWaveClear(events: BugBarrageSimulationEvent[]): void {
    if (this.gameOverValue || this.segmentCount !== 0) {
      return;
    }
    const clearedWave = this.waveValue;
    const bonus = bugBarrageWaveClearScore(clearedWave);
    this.scoreValue += bonus;
    events.push(
      Object.freeze({ type: "wave-cleared", wave: clearedWave, bonus }),
    );
    this.waveValue += 1;
    this.obstaclesValue = this.createWaveField();
    this.updateNextObstacleId();
    this.chainsValue = Object.freeze([this.createWaveChain()]);
    this.roamersValue = Object.freeze([]);
    this.projectiles.reset();
    this.roamerSpawnSeconds = bugBarrageRoamerInterval(
      this.waveValue,
      this.options.difficulty,
    );
  }

  private createWaveField(): readonly BugBarrageObstacle[] {
    const field = createBugBarrageField(
      this.options.rng,
      bugBarrageWaveObstacleCount(this.waveValue, this.options.difficulty),
      this.nextObstacleId,
    );
    this.nextObstacleId += field.length;
    return field;
  }

  private createWaveChain(): BugBarrageChain {
    const count = bugBarrageWaveSegmentCount(
      this.waveValue,
      this.options.difficulty,
    );
    const chain = createBugBarrageChain(this.nextChainId, this.nextSegmentId, count);
    this.nextChainId += 1;
    this.nextSegmentId += count;
    return chain;
  }

  private respawnPosition(): Vector2 {
    return Object.freeze({
      x: BUG_BARRAGE_RUN_RULES.logicalWidth / 2,
      y: BUG_BARRAGE_RUN_RULES.playerRegionBottom - 12,
    });
  }

  private updateNextObstacleId(): void {
    this.nextObstacleId = Math.max(
      this.nextObstacleId,
      1 + Math.max(0, ...this.obstaclesValue.map((obstacle) => obstacle.id)),
    );
  }

  private updateNextChainAndSegmentIds(): void {
    this.nextChainId = Math.max(
      this.nextChainId,
      1 + Math.max(0, ...this.chainsValue.map((chain) => chain.id)),
    );
    this.nextSegmentId = Math.max(
      this.nextSegmentId,
      1 +
        Math.max(
          0,
          ...this.chainsValue.flatMap((chain) =>
            chain.segments.map((segment) => segment.id),
          ),
        ),
    );
  }

  private updateNextRoamerId(): void {
    this.nextRoamerId = Math.max(
      this.nextRoamerId,
      1 + Math.max(0, ...this.roamersValue.map((roamer) => roamer.id)),
    );
  }

  private assertBounds(): void {
    if (
      this.projectiles.projectiles.length > BUG_BARRAGE_LIMITS.maxProjectiles ||
      this.obstaclesValue.length > BUG_BARRAGE_LIMITS.maxObstacles ||
      this.chainsValue.length > BUG_BARRAGE_LIMITS.maxChains ||
      this.segmentCount > BUG_BARRAGE_LIMITS.maxSegments ||
      this.roamersValue.length > BUG_BARRAGE_LIMITS.maxRoamers
    ) {
      throw new Error("Bug Barrage entity bound invariant violated");
    }
  }
}

function distanceSquared(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
