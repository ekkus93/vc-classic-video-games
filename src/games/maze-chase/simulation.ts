import type { RandomService } from "../../engine/index.js";
import {
  MAZE_CHASE_DIFFICULTIES,
  MAZE_CHASE_RUN_RULES,
  MAZE_CHASE_SCORING,
  mazeChaseLevelClearScore,
  mazeChaseLevelSpeedScale,
  type MazeChaseDifficultyId,
  type MazeChasePhaseMode,
} from "./design.js";
import {
  MazeChasePhaseScheduler,
  chooseFrightenedDirection,
  chooseTargetDirection,
  enemyTargetCell,
  type EnemyState,
} from "./enemies.js";
import {
  MAZE_CHASE_MAZE,
  cellKey,
  oppositeDirection,
  sameCell,
  wrappedCellDistanceSquared,
  type Direction,
  type EnemyId,
  type MazeCell,
  type MazeDefinition,
} from "./maze.js";
import {
  advanceCorridorMover,
  corridorPosition,
  createCorridorMover,
  type CorridorMover,
  type CorridorPosition,
} from "./movement.js";

export interface MazeChaseFrameInput {
  readonly desiredDirection: Direction | null;
}

export type MazeChaseSimulationEvent =
  | { readonly type: "pellet-collected"; readonly position: CorridorPosition; readonly points: number }
  | { readonly type: "power-collected"; readonly position: CorridorPosition; readonly points: number }
  | { readonly type: "bonus-appeared"; readonly position: MazeCell }
  | { readonly type: "bonus-collected"; readonly position: MazeCell; readonly points: number }
  | {
      readonly type: "enemy-captured";
      readonly enemy: EnemyId;
      readonly position: CorridorPosition;
      readonly points: number;
    }
  | { readonly type: "player-hit"; readonly livesRemaining: number; readonly position: CorridorPosition }
  | { readonly type: "phase-changed"; readonly mode: MazeChasePhaseMode }
  | { readonly type: "level-cleared"; readonly level: number; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };

export interface MazeChaseSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: MazeChaseDifficultyId;
  readonly maze?: MazeDefinition;
  readonly initialLives?: number;
  readonly initialRespawnGraceSeconds?: number;
}

const TURN_BUFFER_SECONDS = 0.22;
const ENEMY_IDS: readonly EnemyId[] = Object.freeze([
  "amber",
  "cyan",
  "lime",
  "violet",
]);

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export class MazeChaseSimulation {
  private readonly mazeValue: MazeDefinition;
  private readonly phaseScheduler = new MazeChasePhaseScheduler();
  private playerMoverValue: CorridorMover;
  private enemyStateValue: readonly EnemyState[];
  private pelletState: Set<string>;
  private powerState: Set<string>;
  private scoreValue = 0;
  private livesValue: number;
  private levelValue = 1;
  private gameOverValue = false;
  private vulnerabilitySecondsValue = 0;
  private respawnGraceSecondsValue = 0;
  private captureChainValue = 0;
  private bufferedDirection: Direction | null = null;
  private bufferSeconds = 0;
  private bonusSecondsValue = 0;
  private bonusTriggeredValue = false;

  public constructor(private readonly options: MazeChaseSimulationOptions) {
    if (!Object.hasOwn(MAZE_CHASE_DIFFICULTIES, options.difficulty)) {
      throw new Error(`Unsupported Maze Chase difficulty: ${options.difficulty}`);
    }
    this.mazeValue = options.maze ?? MAZE_CHASE_MAZE;
    this.livesValue = options.initialLives ?? MAZE_CHASE_RUN_RULES.startingLives;
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue < 1) {
      throw new RangeError("initialLives must be a positive safe integer");
    }
    this.playerMoverValue = createCorridorMover(this.mazeValue.playerStart);
    this.enemyStateValue = this.createEnemies();
    this.pelletState = new Set(this.mazeValue.pellets);
    this.powerState = new Set(this.mazeValue.powerItems);
    this.respawnGraceSecondsValue =
      options.initialRespawnGraceSeconds ??
      MAZE_CHASE_DIFFICULTIES[options.difficulty].respawnGraceSeconds;
    if (
      !Number.isFinite(this.respawnGraceSecondsValue) ||
      this.respawnGraceSecondsValue < 0
    ) {
      throw new RangeError(
        "initialRespawnGraceSeconds must be a non-negative finite number",
      );
    }
  }

  public get maze(): MazeDefinition {
    return this.mazeValue;
  }

  public get player(): CorridorMover {
    return this.playerMoverValue;
  }

  public get playerPosition(): CorridorPosition {
    return corridorPosition(this.mazeValue, this.playerMoverValue);
  }

  public get enemies(): readonly EnemyState[] {
    return this.enemyStateValue;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get lives(): number {
    return this.livesValue;
  }

  public get level(): number {
    return this.levelValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public get vulnerabilitySeconds(): number {
    return this.vulnerabilitySecondsValue;
  }

  public get respawnGraceSeconds(): number {
    return this.respawnGraceSecondsValue;
  }

  public get phaseMode(): MazeChasePhaseMode {
    return this.phaseScheduler.mode;
  }

  public get remainingPellets(): ReadonlySet<string> {
    return this.pelletState;
  }

  public get remainingPowerItems(): ReadonlySet<string> {
    return this.powerState;
  }

  public get bonusSeconds(): number {
    return this.bonusSecondsValue;
  }

  public get bonusVisible(): boolean {
    return this.bonusSecondsValue > 0;
  }

  public update(
    input: MazeChaseFrameInput,
    dtSeconds: number,
  ): readonly MazeChaseSimulationEvent[] {
    requireDelta(dtSeconds);
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: MazeChaseSimulationEvent[] = [];
    if (input.desiredDirection !== null) {
      this.bufferedDirection = input.desiredDirection;
      this.bufferSeconds = TURN_BUFFER_SECONDS;
    } else {
      this.bufferSeconds = Math.max(0, this.bufferSeconds - dtSeconds);
      if (this.bufferSeconds === 0) {
        this.bufferedDirection = null;
      }
    }

    this.vulnerabilitySecondsValue = Math.max(
      0,
      this.vulnerabilitySecondsValue - dtSeconds,
    );
    if (this.vulnerabilitySecondsValue === 0) {
      this.captureChainValue = 0;
    }
    this.respawnGraceSecondsValue = Math.max(
      0,
      this.respawnGraceSecondsValue - dtSeconds,
    );
    this.bonusSecondsValue = Math.max(0, this.bonusSecondsValue - dtSeconds);

    const phaseChanged = this.phaseScheduler.update(dtSeconds);
    if (phaseChanged) {
      events.push(Object.freeze({ type: "phase-changed", mode: this.phaseScheduler.mode }));
    }

    const profile = MAZE_CHASE_DIFFICULTIES[this.options.difficulty];
    const levelScale = mazeChaseLevelSpeedScale(this.levelValue);
    this.playerMoverValue = advanceCorridorMover(
      this.mazeValue,
      this.playerMoverValue,
      this.bufferedDirection,
      // CR-020: the runner's share of the level ramp plateaus below the sentinels' (see
      // MAZE_CHASE_RUN_RULES) -- the widening gap is what makes later levels harder.
      profile.playerSpeed *
        Math.min(levelScale, MAZE_CHASE_RUN_RULES.maxPlayerLevelSpeedScale) *
        dtSeconds,
    );

    const poweredThisFrame = this.collectAtPlayer(events);
    if (poweredThisFrame) {
      this.vulnerabilitySecondsValue = profile.vulnerabilitySeconds;
      this.captureChainValue = 0;
    }
    this.maybeSpawnBonus(events);
    this.collectBonus(events);

    this.enemyStateValue = Object.freeze(
      this.enemyStateValue.map((enemy) =>
        this.updateEnemy(enemy, dtSeconds, levelScale, poweredThisFrame || phaseChanged),
      ),
    );

    // CR2-007: deliberately hit-then-clear, not the other way around. A tick that both empties
    // the last collectible above and lands the runner on a non-vulnerable sentinel is a genuine
    // contact -- the design (MAZE_CHASE_DESIGN.md) makes no exception for it "because the level
    // happened to end on the same frame", so it costs a life first (resetting actors and the
    // level-progress state resolveCollisions owns), and only then does the now-empty field trigger
    // its own level-clear reset on top. See docs/BUGFIX_SPEC_V2.md §2.3 for the clear-then-hit
    // alternative this rejected, and CR-014's tests for the compound-tick coverage.
    this.resolveCollisions(events);
    this.resolveLevelClear(events);
    return Object.freeze(events);
  }

  private collectAtPlayer(events: MazeChaseSimulationEvent[]): boolean {
    const key = cellKey(this.playerMoverValue.cell);
    const position = this.playerPosition;
    let powered = false;
    if (this.pelletState.delete(key)) {
      this.scoreValue += MAZE_CHASE_SCORING.pellet;
      events.push(
        Object.freeze({
          type: "pellet-collected",
          position,
          points: MAZE_CHASE_SCORING.pellet,
        }),
      );
    }
    if (this.powerState.delete(key)) {
      this.scoreValue += MAZE_CHASE_SCORING.powerItem;
      powered = true;
      events.push(
        Object.freeze({
          type: "power-collected",
          position,
          points: MAZE_CHASE_SCORING.powerItem,
        }),
      );
    }
    return powered;
  }

  private maybeSpawnBonus(events: MazeChaseSimulationEvent[]): void {
    if (this.bonusTriggeredValue) {
      return;
    }
    const total = this.mazeValue.pellets.size + this.mazeValue.powerItems.size;
    const remaining = this.pelletState.size + this.powerState.size;
    const trigger = Math.max(1, Math.floor(total * 0.55));
    if (total > 0 && remaining <= trigger) {
      this.bonusTriggeredValue = true;
      this.bonusSecondsValue = MAZE_CHASE_RUN_RULES.bonusLifetimeSeconds;
      events.push(
        Object.freeze({ type: "bonus-appeared", position: this.mazeValue.bonusSpawn }),
      );
    }
  }

  private collectBonus(events: MazeChaseSimulationEvent[]): void {
    if (
      this.bonusSecondsValue <= 0 ||
      !sameCell(this.playerMoverValue.cell, this.mazeValue.bonusSpawn)
    ) {
      return;
    }
    const points = MAZE_CHASE_SCORING.bonusBase * this.levelValue;
    this.scoreValue += points;
    this.bonusSecondsValue = 0;
    events.push(
      Object.freeze({
        type: "bonus-collected",
        position: this.mazeValue.bonusSpawn,
        points,
      }),
    );
  }

  private updateEnemy(
    enemy: EnemyState,
    dtSeconds: number,
    levelScale: number,
    reverseRequested: boolean,
  ): EnemyState {
    if (enemy.respawnSeconds > 0) {
      const remaining = Math.max(0, enemy.respawnSeconds - dtSeconds);
      return Object.freeze({
        ...enemy,
        mover:
          remaining === 0
            ? createCorridorMover(this.mazeValue.enemyStarts[enemy.id])
            : enemy.mover,
        respawnSeconds: remaining,
      });
    }

    const profile = MAZE_CHASE_DIFFICULTIES[this.options.difficulty];
    const frightened = this.vulnerabilitySecondsValue > 0;
    const speed = profile.enemySpeed * levelScale * (frightened ? 0.82 : 1);
    const currentDirection = enemy.mover.direction;
    const reverseDirection =
      reverseRequested && currentDirection !== null
        ? oppositeDirection(currentDirection)
        : null;
    const mover = advanceCorridorMover(
      this.mazeValue,
      enemy.mover,
      reverseDirection,
      speed * dtSeconds,
      (cell, current) => {
        if (frightened) {
          return chooseFrightenedDirection(this.mazeValue, cell, current, this.options.rng);
        }
        const target = enemyTargetCell(
          this.mazeValue,
          enemy.id,
          this.phaseScheduler.mode,
          { cell: this.playerMoverValue.cell, direction: this.playerMoverValue.direction },
          cell,
        );
        return chooseTargetDirection(this.mazeValue, cell, current, target);
      },
    );
    return Object.freeze({ ...enemy, mover });
  }

  private resolveCollisions(events: MazeChaseSimulationEvent[]): void {
    if (this.gameOverValue) {
      return;
    }
    const playerPosition = this.playerPosition;
    const radiusSquared = MAZE_CHASE_RUN_RULES.collisionRadiusTiles ** 2;
    const enemies = [...this.enemyStateValue];

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];
      if (enemy === undefined || enemy.respawnSeconds > 0) {
        continue;
      }
      const enemyPosition = corridorPosition(this.mazeValue, enemy.mover);
      if (
        wrappedCellDistanceSquared(this.mazeValue, playerPosition, enemyPosition) >
        radiusSquared
      ) {
        continue;
      }

      if (this.vulnerabilitySecondsValue > 0) {
        const points =
          MAZE_CHASE_SCORING.enemyCaptureBase * 2 ** Math.min(this.captureChainValue, 3);
        this.captureChainValue += 1;
        this.scoreValue += points;
        enemies[index] = Object.freeze({
          ...enemy,
          mover: createCorridorMover(this.mazeValue.enemyStarts[enemy.id]),
          respawnSeconds: MAZE_CHASE_RUN_RULES.enemyRespawnSeconds,
        });
        events.push(
          Object.freeze({
            type: "enemy-captured",
            enemy: enemy.id,
            position: enemyPosition,
            points,
          }),
        );
        continue;
      }

      if (this.respawnGraceSecondsValue > 0) {
        continue;
      }

      this.livesValue -= 1;
      events.push(
        Object.freeze({
          type: "player-hit",
          livesRemaining: this.livesValue,
          position: playerPosition,
        }),
      );
      if (this.livesValue <= 0) {
        this.gameOverValue = true;
        events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      } else {
        this.resetActors();
        this.respawnGraceSecondsValue =
          MAZE_CHASE_DIFFICULTIES[this.options.difficulty].respawnGraceSeconds;
        this.vulnerabilitySecondsValue = 0;
        this.captureChainValue = 0;
        return;
      }
      this.vulnerabilitySecondsValue = 0;
      this.captureChainValue = 0;
      break;
    }

    this.enemyStateValue = Object.freeze(enemies);
  }

  private resolveLevelClear(events: MazeChaseSimulationEvent[]): void {
    if (
      this.gameOverValue ||
      this.pelletState.size > 0 ||
      this.powerState.size > 0
    ) {
      return;
    }
    const clearedLevel = this.levelValue;
    const bonus = mazeChaseLevelClearScore(clearedLevel);
    this.scoreValue += bonus;
    events.push(
      Object.freeze({ type: "level-cleared", level: clearedLevel, bonus }),
    );
    this.levelValue += 1;
    this.pelletState = new Set(this.mazeValue.pellets);
    this.powerState = new Set(this.mazeValue.powerItems);
    this.bonusSecondsValue = 0;
    this.bonusTriggeredValue = false;
    this.vulnerabilitySecondsValue = 0;
    this.captureChainValue = 0;
    this.phaseScheduler.reset();
    this.resetActors();
    this.respawnGraceSecondsValue =
      MAZE_CHASE_DIFFICULTIES[this.options.difficulty].respawnGraceSeconds;
  }

  private resetActors(): void {
    this.playerMoverValue = createCorridorMover(this.mazeValue.playerStart);
    this.enemyStateValue = this.createEnemies();
    this.bufferedDirection = null;
    this.bufferSeconds = 0;
  }

  private createEnemies(): readonly EnemyState[] {
    return Object.freeze(
      ENEMY_IDS.map((id) =>
        Object.freeze({
          id,
          mover: createCorridorMover(this.mazeValue.enemyStarts[id]),
          respawnSeconds: 0,
        }),
      ),
    );
  }
}
