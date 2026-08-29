import type { RandomService } from "../../engine/index.js";
import {
  DEEP_DIGGER_DIFFICULTIES,
  DEEP_DIGGER_RUN_RULES,
  DEEP_DIGGER_SCORING,
  deepDiggerWaveClearScore,
  type DeepDiggerDifficultyId,
} from "./design.js";
import {
  createDeepDiggerLevel,
  type DeepDiggerLevelDefinition,
} from "./level.js";
import {
  DeepDiggerTerrain,
  sameCell,
  stepCell,
  type GridCell,
  type GridDirection,
} from "./terrain.js";

export interface DeepDiggerFrameInput {
  readonly move: GridDirection | null;
  readonly attack: boolean;
}

export interface DeepDiggerPlayerState {
  readonly cell: GridCell;
  readonly facing: GridDirection;
}

export type DeepDiggerEnemyMode = "tunnel" | "phase";

export interface DeepDiggerEnemyState {
  readonly id: number;
  readonly cell: GridCell;
  readonly mode: DeepDiggerEnemyMode;
  readonly pressureStage: number;
  readonly pressureRemainingSeconds: number;
  readonly phaseRemainingSeconds: number;
  readonly phaseCooldownSeconds: number;
}

export type DeepDiggerRockState = "supported" | "shaking" | "falling" | "resting";

export interface DeepDiggerRock {
  readonly id: number;
  readonly cell: GridCell;
  readonly state: DeepDiggerRockState;
  readonly shakeRemainingSeconds: number;
  readonly fallStepRemainingSeconds: number;
  readonly cellsFallen: number;
}

export type DeepDiggerSimulationEvent =
  | { readonly type: "dug"; readonly cell: GridCell; readonly points: number }
  | { readonly type: "pump-fired"; readonly from: GridCell; readonly to: GridCell }
  | {
      readonly type: "enemy-pressured";
      readonly enemyId: number;
      readonly stage: number;
      readonly cell: GridCell;
    }
  | {
      readonly type: "enemy-defeated";
      readonly enemyId: number;
      readonly points: number;
      readonly cell: GridCell;
    }
  | { readonly type: "enemy-phased"; readonly enemyId: number; readonly cell: GridCell }
  | { readonly type: "rock-loosened"; readonly rockId: number; readonly cell: GridCell }
  | { readonly type: "rock-falling"; readonly rockId: number; readonly cell: GridCell }
  | {
      readonly type: "rock-landed";
      readonly rockId: number;
      readonly cellsFallen: number;
      readonly points: number;
      readonly cell: GridCell;
    }
  | {
      readonly type: "enemy-crushed";
      readonly enemyId: number;
      readonly rockId: number;
      readonly points: number;
      readonly cell: GridCell;
    }
  | {
      readonly type: "player-hit";
      readonly livesRemaining: number;
      readonly cell: GridCell;
    }
  | { readonly type: "wave-cleared"; readonly wave: number; readonly bonus: number }
  | { readonly type: "game-over"; readonly score: number };

export interface DeepDiggerSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: DeepDiggerDifficultyId;
  readonly level?: DeepDiggerLevelDefinition;
  readonly initialLives?: number;
  readonly initialInvulnerabilitySeconds?: number;
}

interface MutableEnemy {
  id: number;
  cell: GridCell;
  mode: DeepDiggerEnemyMode;
  pressureStage: number;
  pressureRemainingSeconds: number;
  phaseRemainingSeconds: number;
  phaseCooldownSeconds: number;
  moveRemainingSeconds: number;
}

interface MutableRock {
  id: number;
  cell: GridCell;
  state: DeepDiggerRockState;
  shakeRemainingSeconds: number;
  fallStepRemainingSeconds: number;
  cellsFallen: number;
}

const ROCK_FALL_STEP_SECONDS = 0.08;
const PUMP_FLASH_SECONDS = 0.12;

function copyCell(cell: GridCell): GridCell {
  return Object.freeze({ column: cell.column, row: cell.row });
}

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export class DeepDiggerSimulation {
  private level: DeepDiggerLevelDefinition;
  private terrainValue: DeepDiggerTerrain;
  private playerValue: DeepDiggerPlayerState;
  private enemyState: MutableEnemy[] = [];
  private rockState: MutableRock[] = [];
  private livesValue: number;
  private scoreValue = 0;
  private waveValue = 1;
  private gameOverValue = false;
  private invulnerabilityValue: number;
  private playerMoveRemainingSeconds = 0;
  private pumpTargetValue: GridCell | null = null;
  private pumpFlashRemainingSeconds = 0;

  public constructor(private readonly options: DeepDiggerSimulationOptions) {
    this.level = options.level ?? createDeepDiggerLevel(options.difficulty, 1);
    this.terrainValue = new DeepDiggerTerrain(
      this.level.columns,
      this.level.rows,
      this.level.tunnels,
    );
    this.playerValue = Object.freeze({
      cell: copyCell(this.level.playerSpawn),
      facing: "right",
    });
    this.livesValue = options.initialLives ?? DEEP_DIGGER_RUN_RULES.startingLives;
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue <= 0) {
      throw new RangeError("initialLives must be a positive safe integer");
    }
    this.invulnerabilityValue = options.initialInvulnerabilitySeconds ?? 0;
    if (!Number.isFinite(this.invulnerabilityValue) || this.invulnerabilityValue < 0) {
      throw new RangeError("initialInvulnerabilitySeconds must be non-negative and finite");
    }
    this.populateActors();
  }

  public get terrain(): DeepDiggerTerrain {
    return this.terrainValue;
  }

  public get player(): DeepDiggerPlayerState {
    return this.playerValue;
  }

  public get enemies(): readonly DeepDiggerEnemyState[] {
    return Object.freeze(
      this.enemyState.map((enemy) =>
        Object.freeze({
          id: enemy.id,
          cell: copyCell(enemy.cell),
          mode: enemy.mode,
          pressureStage: enemy.pressureStage,
          pressureRemainingSeconds: enemy.pressureRemainingSeconds,
          phaseRemainingSeconds: enemy.phaseRemainingSeconds,
          phaseCooldownSeconds: enemy.phaseCooldownSeconds,
        }),
      ),
    );
  }

  public get rocks(): readonly DeepDiggerRock[] {
    return Object.freeze(
      this.rockState.map((rock) =>
        Object.freeze({
          id: rock.id,
          cell: copyCell(rock.cell),
          state: rock.state,
          shakeRemainingSeconds: rock.shakeRemainingSeconds,
          fallStepRemainingSeconds: rock.fallStepRemainingSeconds,
          cellsFallen: rock.cellsFallen,
        }),
      ),
    );
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

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public get invulnerabilitySeconds(): number {
    return this.invulnerabilityValue;
  }

  public get pumpTarget(): GridCell | null {
    return this.pumpTargetValue;
  }

  public get pumpVisible(): boolean {
    return this.pumpFlashRemainingSeconds > 0 && this.pumpTargetValue !== null;
  }

  public update(
    input: DeepDiggerFrameInput,
    dtSeconds: number,
  ): readonly DeepDiggerSimulationEvent[] {
    requireDelta(dtSeconds);
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: DeepDiggerSimulationEvent[] = [];
    this.invulnerabilityValue = Math.max(0, this.invulnerabilityValue - dtSeconds);
    this.playerMoveRemainingSeconds = Math.max(
      0,
      this.playerMoveRemainingSeconds - dtSeconds,
    );
    this.pumpFlashRemainingSeconds = Math.max(
      0,
      this.pumpFlashRemainingSeconds - dtSeconds,
    );
    this.updatePressureDecay(dtSeconds);

    if (input.move !== null) {
      this.movePlayer(input.move, events);
    }
    if (input.attack) {
      this.firePump(events);
    }

    this.updateRocks(dtSeconds, events);
    this.updateEnemies(dtSeconds, events);
    this.resolveEnemyContact(events);
    this.resolveWaveClear(events);

    return Object.freeze(events);
  }

  private movePlayer(
    direction: GridDirection,
    events: DeepDiggerSimulationEvent[],
  ): void {
    this.playerValue = Object.freeze({ ...this.playerValue, facing: direction });
    if (this.playerMoveRemainingSeconds > 0) {
      return;
    }
    const target = stepCell(this.playerValue.cell, direction);
    if (!this.terrainValue.inBounds(target) || this.isRockAt(target)) {
      return;
    }

    const dug = this.terrainValue.carve(target);
    this.playerValue = Object.freeze({ cell: copyCell(target), facing: direction });
    this.playerMoveRemainingSeconds = DEEP_DIGGER_RUN_RULES.playerMoveIntervalSeconds;
    if (dug) {
      this.scoreValue += DEEP_DIGGER_SCORING.earthCell;
      events.push(
        Object.freeze({
          type: "dug",
          cell: copyCell(target),
          points: DEEP_DIGGER_SCORING.earthCell,
        }),
      );
    }
  }

  private firePump(events: DeepDiggerSimulationEvent[]): void {
    let endpoint = this.playerValue.cell;
    let targetEnemy: MutableEnemy | undefined;
    for (let distance = 1; distance <= DEEP_DIGGER_RUN_RULES.pumpRangeTiles; distance += 1) {
      const candidate = stepCell(endpoint, this.playerValue.facing);
      if (!this.terrainValue.inBounds(candidate) || !this.terrainValue.isTunnel(candidate)) {
        break;
      }
      endpoint = candidate;
      const enemy = this.enemyState.find(
        (entry) => entry.mode === "tunnel" && sameCell(entry.cell, candidate),
      );
      if (enemy !== undefined) {
        targetEnemy = enemy;
        break;
      }
      if (this.isRockAt(candidate)) {
        break;
      }
    }

    this.pumpTargetValue = copyCell(endpoint);
    this.pumpFlashRemainingSeconds = PUMP_FLASH_SECONDS;
    events.push(
      Object.freeze({
        type: "pump-fired",
        from: copyCell(this.playerValue.cell),
        to: copyCell(endpoint),
      }),
    );

    if (targetEnemy === undefined) {
      return;
    }
    targetEnemy.pressureStage += 1;
    targetEnemy.pressureRemainingSeconds = DEEP_DIGGER_RUN_RULES.pressureDecaySeconds;
    events.push(
      Object.freeze({
        type: "enemy-pressured",
        enemyId: targetEnemy.id,
        stage: targetEnemy.pressureStage,
        cell: copyCell(targetEnemy.cell),
      }),
    );
    if (targetEnemy.pressureStage < DEEP_DIGGER_RUN_RULES.pressureStages) {
      return;
    }

    const points =
      DEEP_DIGGER_SCORING.pressureDefeatBase +
      DEEP_DIGGER_SCORING.pressureDefeatPerWave * (this.waveValue - 1);
    this.scoreValue += points;
    this.enemyState = this.enemyState.filter((enemy) => enemy.id !== targetEnemy.id);
    events.push(
      Object.freeze({
        type: "enemy-defeated",
        enemyId: targetEnemy.id,
        points,
        cell: copyCell(targetEnemy.cell),
      }),
    );
  }

  private updatePressureDecay(dtSeconds: number): void {
    for (const enemy of this.enemyState) {
      if (enemy.pressureStage <= 0) {
        continue;
      }
      enemy.pressureRemainingSeconds = Math.max(
        0,
        enemy.pressureRemainingSeconds - dtSeconds,
      );
      if (enemy.pressureRemainingSeconds === 0) {
        enemy.pressureStage = 0;
      }
    }
  }

  private updateEnemies(
    dtSeconds: number,
    events: DeepDiggerSimulationEvent[],
  ): void {
    const profile = DEEP_DIGGER_DIFFICULTIES[this.options.difficulty];
    for (const enemy of this.enemyState) {
      enemy.phaseCooldownSeconds = Math.max(0, enemy.phaseCooldownSeconds - dtSeconds);
      if (enemy.mode === "phase") {
        enemy.phaseRemainingSeconds = Math.max(0, enemy.phaseRemainingSeconds - dtSeconds);
      }
      enemy.moveRemainingSeconds -= dtSeconds;
      if (enemy.moveRemainingSeconds > 0) {
        continue;
      }
      enemy.moveRemainingSeconds += profile.enemyMoveIntervalSeconds;

      if (enemy.mode === "phase") {
        this.movePhasedEnemy(enemy);
        if (this.terrainValue.isTunnel(enemy.cell) && enemy.phaseRemainingSeconds <= 0) {
          enemy.mode = "tunnel";
          enemy.phaseCooldownSeconds = profile.phaseCooldownSeconds;
        } else if (!this.terrainValue.isTunnel(enemy.cell) && enemy.phaseRemainingSeconds <= 0) {
          enemy.phaseRemainingSeconds = profile.enemyMoveIntervalSeconds;
        }
        continue;
      }

      const path = this.terrainValue.findTunnelPath(enemy.cell, this.playerValue.cell);
      const next = path[1];
      if (next !== undefined && !this.isRockAt(next)) {
        enemy.cell = copyCell(next);
        continue;
      }
      if (enemy.phaseCooldownSeconds <= 0 && !sameCell(enemy.cell, this.playerValue.cell)) {
        enemy.mode = "phase";
        enemy.phaseRemainingSeconds = profile.phaseDurationSeconds;
        events.push(
          Object.freeze({
            type: "enemy-phased",
            enemyId: enemy.id,
            cell: copyCell(enemy.cell),
          }),
        );
      }
    }
  }

  private movePhasedEnemy(enemy: MutableEnemy): void {
    const horizontalDelta = this.playerValue.cell.column - enemy.cell.column;
    const verticalDelta = this.playerValue.cell.row - enemy.cell.row;
    if (horizontalDelta === 0 && verticalDelta === 0) {
      return;
    }

    const horizontalFirst =
      Math.abs(horizontalDelta) > Math.abs(verticalDelta) ||
      (Math.abs(horizontalDelta) === Math.abs(verticalDelta) &&
        this.options.rng.nextFloat() < 0.5);
    let direction: GridDirection;
    if (horizontalFirst && horizontalDelta !== 0) {
      direction = horizontalDelta < 0 ? "left" : "right";
    } else if (verticalDelta !== 0) {
      direction = verticalDelta < 0 ? "up" : "down";
    } else {
      direction = horizontalDelta < 0 ? "left" : "right";
    }
    const target = stepCell(enemy.cell, direction);
    if (this.terrainValue.inBounds(target) && !this.isRockAt(target)) {
      enemy.cell = copyCell(target);
    }
  }

  private updateRocks(
    dtSeconds: number,
    events: DeepDiggerSimulationEvent[],
  ): void {
    const profile = DEEP_DIGGER_DIFFICULTIES[this.options.difficulty];
    for (const rock of this.rockState) {
      if (rock.state === "resting") {
        continue;
      }
      let remainingSeconds = dtSeconds;
      if (rock.state === "supported") {
        const below = stepCell(rock.cell, "down");
        if (
          this.terrainValue.inBounds(below) &&
          this.terrainValue.isTunnel(below) &&
          !this.isRockAt(below, rock.id)
        ) {
          rock.state = "shaking";
          rock.shakeRemainingSeconds = profile.rockShakeSeconds;
          events.push(
            Object.freeze({
              type: "rock-loosened",
              rockId: rock.id,
              cell: copyCell(rock.cell),
            }),
          );
        }
        continue;
      }
      if (rock.state === "shaking") {
        if (remainingSeconds < rock.shakeRemainingSeconds) {
          rock.shakeRemainingSeconds -= remainingSeconds;
          continue;
        }
        remainingSeconds -= rock.shakeRemainingSeconds;
        rock.shakeRemainingSeconds = 0;
        rock.state = "falling";
        rock.fallStepRemainingSeconds = 0;
        this.terrainValue.carve(rock.cell);
        events.push(
          Object.freeze({
            type: "rock-falling",
            rockId: rock.id,
            cell: copyCell(rock.cell),
          }),
        );
      }
      if (rock.state !== "falling") {
        continue;
      }

      rock.fallStepRemainingSeconds -= remainingSeconds;
      let steps = 0;
      while (rock.fallStepRemainingSeconds <= 0 && steps < this.level.rows) {
        steps += 1;
        const below = stepCell(rock.cell, "down");
        if (
          !this.terrainValue.inBounds(below) ||
          !this.terrainValue.isTunnel(below) ||
          this.isRockAt(below, rock.id)
        ) {
          this.landRock(rock, events);
          break;
        }
        rock.cell = copyCell(below);
        rock.cellsFallen += 1;
        rock.fallStepRemainingSeconds += ROCK_FALL_STEP_SECONDS;
        this.resolveRockContacts(rock, events);
      }
    }
  }

  private landRock(
    rock: MutableRock,
    events: DeepDiggerSimulationEvent[],
  ): void {
    rock.state = "resting";
    rock.fallStepRemainingSeconds = 0;
    const points = rock.cellsFallen * DEEP_DIGGER_SCORING.rockDropPerCell;
    this.scoreValue += points;
    events.push(
      Object.freeze({
        type: "rock-landed",
        rockId: rock.id,
        cellsFallen: rock.cellsFallen,
        points,
        cell: copyCell(rock.cell),
      }),
    );
  }

  private resolveRockContacts(
    rock: MutableRock,
    events: DeepDiggerSimulationEvent[],
  ): void {
    const crushed = this.enemyState.filter((enemy) => sameCell(enemy.cell, rock.cell));
    if (crushed.length > 0) {
      const crushedIds = new Set(crushed.map((enemy) => enemy.id));
      this.enemyState = this.enemyState.filter((enemy) => !crushedIds.has(enemy.id));
      for (const enemy of crushed) {
        this.scoreValue += DEEP_DIGGER_SCORING.rockCrush;
        events.push(
          Object.freeze({
            type: "enemy-crushed",
            enemyId: enemy.id,
            rockId: rock.id,
            points: DEEP_DIGGER_SCORING.rockCrush,
            cell: copyCell(rock.cell),
          }),
        );
      }
    }
    if (sameCell(this.playerValue.cell, rock.cell)) {
      this.hitPlayer(events);
    }
  }

  private resolveEnemyContact(events: DeepDiggerSimulationEvent[]): void {
    if (this.invulnerabilityValue > 0 || this.gameOverValue) {
      return;
    }
    if (this.enemyState.some((enemy) => sameCell(enemy.cell, this.playerValue.cell))) {
      this.hitPlayer(events);
    }
  }

  private hitPlayer(events: DeepDiggerSimulationEvent[]): void {
    if (this.invulnerabilityValue > 0 || this.gameOverValue) {
      return;
    }
    const hitCell = copyCell(this.playerValue.cell);
    this.livesValue -= 1;
    events.push(
      Object.freeze({
        type: "player-hit",
        livesRemaining: this.livesValue,
        cell: hitCell,
      }),
    );
    if (this.livesValue <= 0) {
      this.gameOverValue = true;
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      return;
    }
    this.playerValue = Object.freeze({
      cell: copyCell(this.level.playerSpawn),
      facing: "right",
    });
    this.playerMoveRemainingSeconds = 0;
    this.invulnerabilityValue = DEEP_DIGGER_RUN_RULES.playerInvulnerabilitySeconds;
  }

  private resolveWaveClear(events: DeepDiggerSimulationEvent[]): void {
    if (this.gameOverValue || this.enemyState.length !== 0) {
      return;
    }
    // CR-008: settle any rock still "shaking"/"falling" before the level, terrain, and rockState
    // are torn down and replaced with the next wave's fresh spawns below. Without this, a rock
    // mid-fall when the last enemy dies was silently discarded -- its in-flight state and any
    // cellsFallen score it was about to earn just vanished, with no event. Landing it in place
    // here first (0 points for a rock that hadn't started falling yet, its earned points
    // otherwise) preserves that outcome instead of losing it to iteration order.
    for (const rock of this.rockState) {
      if (rock.state === "shaking" || rock.state === "falling") {
        this.landRock(rock, events);
      }
    }
    const clearedWave = this.waveValue;
    const bonus = deepDiggerWaveClearScore(clearedWave);
    this.scoreValue += bonus;
    events.push(
      Object.freeze({ type: "wave-cleared", wave: clearedWave, bonus }),
    );
    this.waveValue += 1;
    if (this.options.level !== undefined) {
      this.level = this.options.level;
    } else {
      this.level = createDeepDiggerLevel(this.options.difficulty, this.waveValue);
    }
    this.terrainValue = new DeepDiggerTerrain(
      this.level.columns,
      this.level.rows,
      this.level.tunnels,
    );
    this.playerValue = Object.freeze({
      cell: copyCell(this.level.playerSpawn),
      facing: "right",
    });
    this.playerMoveRemainingSeconds = 0;
    this.invulnerabilityValue = DEEP_DIGGER_RUN_RULES.playerInvulnerabilitySeconds;
    this.populateActors();
  }

  private populateActors(): void {
    this.enemyState = this.level.enemySpawns
      .slice(0, DEEP_DIGGER_RUN_RULES.maxEnemies)
      .map((cell, index) => ({
        id: index + 1,
        cell: copyCell(cell),
        mode: "tunnel" as const,
        pressureStage: 0,
        pressureRemainingSeconds: 0,
        phaseRemainingSeconds: 0,
        phaseCooldownSeconds: 0,
        moveRemainingSeconds: 0,
      }));
    this.rockState = this.level.rockSpawns
      .slice(0, DEEP_DIGGER_RUN_RULES.maxRocks)
      .map((cell, index) => ({
        id: index + 1,
        cell: copyCell(cell),
        state: "supported" as const,
        shakeRemainingSeconds: 0,
        fallStepRemainingSeconds: 0,
        cellsFallen: 0,
      }));
  }

  private isRockAt(cell: GridCell, ignoredRockId?: number): boolean {
    return this.rockState.some(
      (rock) =>
        rock.id !== ignoredRockId &&
        rock.state !== "falling" &&
        sameCell(rock.cell, cell),
    );
  }
}
