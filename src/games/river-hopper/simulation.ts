import type { Aabb, Vector2 } from "../../engine/index.js";
import {
  RIVER_HOPPER_DIFFICULTIES,
  RIVER_HOPPER_GOAL_COLUMNS,
  RIVER_HOPPER_RUN_RULES,
  RIVER_HOPPER_SCORING,
  RIVER_HOPPER_STAGES,
  riverHopperGoalCenter,
  riverHopperRoundBonus,
  riverHopperRowCenter,
  type RiverHopperDifficultyId,
  type RiverHopperDirection,
  type RiverHopperStageDefinition,
} from "./design.js";
import {
  createRiverHopperLane,
  riverHopperLaneOverlaps,
  riverHopperLaneVelocity,
  stepRiverHopperLane,
  type RiverHopperLaneState,
} from "./moving-lane.js";

export type RiverHopperLifeLossReason =
  | "vehicle"
  | "water"
  | "bank-edge"
  | "timeout"
  | "closed-goal";

export type RiverHopperSimulationEvent =
  | { readonly type: "hop-started"; readonly direction: RiverHopperDirection }
  | {
      readonly type: "hop-completed";
      readonly direction: RiverHopperDirection;
      readonly row: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "life-lost";
      readonly reason: RiverHopperLifeLossReason;
      readonly livesRemaining: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "goal-filled";
      readonly slotIndex: number;
      readonly points: number;
      readonly timeBonus: number;
    }
  | {
      readonly type: "round-cleared";
      readonly round: number;
      readonly bonus: number;
      readonly nextRound: number;
      readonly nextStageId: string;
    }
  | { readonly type: "game-over"; readonly score: number };

export interface RiverHopperPlayerSnapshot {
  readonly position: Vector2;
  readonly row: number;
  readonly moving: boolean;
  readonly bufferedDirection: RiverHopperDirection | null;
}

interface ActiveHop {
  readonly direction: RiverHopperDirection;
  readonly start: Vector2;
  readonly target: Vector2;
  readonly targetRow: number;
  readonly elapsedSeconds: number;
}

export interface RiverHopperSimulationOptions {
  readonly difficulty: RiverHopperDifficultyId;
  readonly stages?: readonly RiverHopperStageDefinition[];
  readonly initialLives?: number;
  readonly initialRound?: number;
  readonly initialTimeSeconds?: number;
  readonly initialFilledGoals?: readonly boolean[];
  readonly initialPlayer?: {
    readonly x: number;
    readonly row: number;
  };
}

function freezePosition(x: number, y: number): Vector2 {
  return Object.freeze({ x, y });
}

function playerBounds(position: Vector2): Aabb {
  return {
    x: position.x - RIVER_HOPPER_RUN_RULES.playerWidth / 2,
    y: position.y - RIVER_HOPPER_RUN_RULES.playerHeight / 2,
    width: RIVER_HOPPER_RUN_RULES.playerWidth,
    height: RIVER_HOPPER_RUN_RULES.playerHeight,
  };
}

function goalBounds(slotIndex: number): Aabb {
  return {
    x: riverHopperGoalCenter(slotIndex) - 13,
    y: riverHopperRowCenter(RIVER_HOPPER_RUN_RULES.goalRow) - 7,
    width: 26,
    height: 14,
  };
}

function overlapArea(a: Aabb, b: Aabb): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function validDirection(value: RiverHopperDirection | null): void {
  if (
    value !== null &&
    value !== "up" &&
    value !== "down" &&
    value !== "left" &&
    value !== "right"
  ) {
    throw new Error(`Unsupported River Hopper direction: ${String(value)}`);
  }
}

export class RiverHopperSimulation {
  private readonly stages: readonly RiverHopperStageDefinition[];
  private lanesValue: readonly RiverHopperLaneState[] = Object.freeze([]);
  private positionValue: Vector2;
  private rowValue: number;
  private activeHop: ActiveHop | null = null;
  private bufferedDirectionValue: RiverHopperDirection | null = null;
  private livesValue: number;
  private scoreValue = 0;
  private roundValue: number;
  private timeRemainingValue: number;
  private filledGoalsValue: readonly boolean[];
  private furthestRowThisLife: number;
  private gameOverValue = false;

  public constructor(private readonly options: RiverHopperSimulationOptions) {
    if (!Object.hasOwn(RIVER_HOPPER_DIFFICULTIES, options.difficulty)) {
      throw new Error(`Unsupported River Hopper difficulty: ${options.difficulty}`);
    }
    this.stages = options.stages ?? RIVER_HOPPER_STAGES;
    if (this.stages.length === 0) {
      throw new RangeError("River Hopper requires at least one stage");
    }

    this.livesValue = options.initialLives ?? RIVER_HOPPER_RUN_RULES.startingLives;
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue <= 0) {
      throw new RangeError("initialLives must be a positive safe integer");
    }
    this.roundValue = options.initialRound ?? 1;
    if (!Number.isSafeInteger(this.roundValue) || this.roundValue < 1) {
      throw new RangeError("initialRound must be a positive safe integer");
    }

    const filled = options.initialFilledGoals ?? RIVER_HOPPER_GOAL_COLUMNS.map(() => false);
    if (filled.length !== RIVER_HOPPER_GOAL_COLUMNS.length) {
      throw new RangeError("initialFilledGoals must match the goal-slot count");
    }
    this.filledGoalsValue = Object.freeze([...filled]);

    const initialPlayer = options.initialPlayer ?? {
      x: RIVER_HOPPER_RUN_RULES.logicalWidth / 2,
      row: RIVER_HOPPER_RUN_RULES.startRow,
    };
    if (
      !Number.isFinite(initialPlayer.x) ||
      !Number.isInteger(initialPlayer.row) ||
      initialPlayer.row < 0 ||
      initialPlayer.row >= RIVER_HOPPER_RUN_RULES.rowCount
    ) {
      throw new RangeError("initialPlayer must reference a finite in-play row position");
    }
    this.positionValue = freezePosition(
      initialPlayer.x,
      riverHopperRowCenter(initialPlayer.row),
    );
    this.rowValue = initialPlayer.row;
    this.furthestRowThisLife = initialPlayer.row;
    this.lanesValue = this.createStageLanes();

    this.timeRemainingValue = options.initialTimeSeconds ?? this.timerForRound();
    if (!Number.isFinite(this.timeRemainingValue) || this.timeRemainingValue <= 0) {
      throw new RangeError("initialTimeSeconds must be positive and finite");
    }
  }

  public get player(): RiverHopperPlayerSnapshot {
    return Object.freeze({
      position: this.positionValue,
      row: this.rowValue,
      moving: this.activeHop !== null,
      bufferedDirection: this.bufferedDirectionValue,
    });
  }

  public get lanes(): readonly RiverHopperLaneState[] {
    return this.lanesValue;
  }

  public get lives(): number {
    return this.livesValue;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get round(): number {
    return this.roundValue;
  }

  public get timeRemainingSeconds(): number {
    return this.timeRemainingValue;
  }

  public get filledGoals(): readonly boolean[] {
    return this.filledGoalsValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public get stage(): RiverHopperStageDefinition {
    const stage = this.stages[(this.roundValue - 1) % this.stages.length];
    if (stage === undefined) {
      throw new Error("River Hopper stage selection failed");
    }
    return stage;
  }

  public update(
    direction: RiverHopperDirection | null,
    dtSeconds: number,
  ): readonly RiverHopperSimulationEvent[] {
    validDirection(direction);
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: RiverHopperSimulationEvent[] = [];
    this.timeRemainingValue = Math.max(0, this.timeRemainingValue - dtSeconds);
    if (this.timeRemainingValue <= 0) {
      this.loseLife("timeout", events);
      return Object.freeze(events);
    }

    const carryingVelocity = this.supportingPlatformVelocity();
    const speedScale = this.currentSpeedScale();
    this.lanesValue = Object.freeze(
      this.lanesValue.map((lane) => stepRiverHopperLane(lane, dtSeconds, speedScale)),
    );
    if (carryingVelocity !== null) {
      this.positionValue = freezePosition(
        this.positionValue.x + carryingVelocity * dtSeconds,
        this.positionValue.y,
      );
    }

    if (direction !== null) {
      if (this.activeHop === null) {
        this.beginHop(direction, events);
      } else {
        this.bufferedDirectionValue = direction;
      }
    }
    this.advanceHop(dtSeconds, events);

    if (this.resolveBoundary(events)) {
      return Object.freeze(events);
    }
    if (this.resolveRoadCollision(events)) {
      return Object.freeze(events);
    }
    if (this.resolveGoal(events)) {
      return Object.freeze(events);
    }
    this.resolveRiverSupport(events);

    return Object.freeze(events);
  }

  private beginHop(
    direction: RiverHopperDirection,
    events: RiverHopperSimulationEvent[],
  ): boolean {
    const verticalDelta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    const horizontalDelta = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const targetRow = this.rowValue + verticalDelta;
    if (targetRow < RIVER_HOPPER_RUN_RULES.goalRow || targetRow > RIVER_HOPPER_RUN_RULES.startRow) {
      return false;
    }

    const target = freezePosition(
      this.positionValue.x + horizontalDelta * RIVER_HOPPER_RUN_RULES.horizontalHopDistance,
      verticalDelta === 0 ? this.positionValue.y : riverHopperRowCenter(targetRow),
    );
    this.activeHop = Object.freeze({
      direction,
      start: this.positionValue,
      target,
      targetRow,
      elapsedSeconds: 0,
    });
    events.push(Object.freeze({ type: "hop-started", direction }));
    return true;
  }

  private advanceHop(
    dtSeconds: number,
    events: RiverHopperSimulationEvent[],
  ): void {
    const hop = this.activeHop;
    if (hop === null) {
      return;
    }
    const elapsedSeconds = hop.elapsedSeconds + dtSeconds;
    const progress = Math.min(
      1,
      elapsedSeconds / RIVER_HOPPER_RUN_RULES.hopDurationSeconds,
    );
    this.positionValue = freezePosition(
      hop.start.x + (hop.target.x - hop.start.x) * progress,
      hop.start.y + (hop.target.y - hop.start.y) * progress,
    );

    if (progress < 1) {
      this.activeHop = Object.freeze({ ...hop, elapsedSeconds });
      return;
    }

    this.positionValue = hop.target;
    this.rowValue = hop.targetRow;
    this.activeHop = null;
    if (this.rowValue < this.furthestRowThisLife) {
      const rowsAdvanced = this.furthestRowThisLife - this.rowValue;
      this.scoreValue += rowsAdvanced * RIVER_HOPPER_SCORING.forwardRow;
      this.furthestRowThisLife = this.rowValue;
    }
    events.push(
      Object.freeze({
        type: "hop-completed",
        direction: hop.direction,
        row: this.rowValue,
        position: this.positionValue,
      }),
    );

    const buffered = this.bufferedDirectionValue;
    this.bufferedDirectionValue = null;
    if (buffered !== null) {
      this.beginHop(buffered, events);
    }
  }

  private supportingPlatformVelocity(): number | null {
    if (this.activeHop !== null) {
      return null;
    }
    const lane = this.lanesValue.find(
      (candidate) =>
        candidate.definition.row === this.rowValue &&
        candidate.definition.kind === "river",
    );
    if (lane === undefined || !riverHopperLaneOverlaps(lane, playerBounds(this.positionValue))) {
      return null;
    }
    return riverHopperLaneVelocity(lane, this.currentSpeedScale());
  }

  private resolveBoundary(events: RiverHopperSimulationEvent[]): boolean {
    const bounds = playerBounds(this.positionValue);
    if (
      bounds.x >= 0 &&
      bounds.x + bounds.width <= RIVER_HOPPER_RUN_RULES.logicalWidth
    ) {
      return false;
    }
    this.loseLife("bank-edge", events);
    return true;
  }

  private resolveRoadCollision(events: RiverHopperSimulationEvent[]): boolean {
    const bounds = playerBounds(this.positionValue);
    const collided = this.lanesValue.some(
      (lane) => lane.definition.kind === "road" && riverHopperLaneOverlaps(lane, bounds),
    );
    if (!collided) {
      return false;
    }
    this.loseLife("vehicle", events);
    return true;
  }

  private resolveRiverSupport(events: RiverHopperSimulationEvent[]): void {
    if (this.activeHop !== null) {
      return;
    }
    const riverLane = this.lanesValue.find(
      (lane) =>
        lane.definition.row === this.rowValue &&
        lane.definition.kind === "river",
    );
    if (riverLane === undefined) {
      return;
    }
    if (!riverHopperLaneOverlaps(riverLane, playerBounds(this.positionValue))) {
      this.loseLife("water", events);
    }
  }

  private resolveGoal(events: RiverHopperSimulationEvent[]): boolean {
    if (this.activeHop !== null || this.rowValue !== RIVER_HOPPER_RUN_RULES.goalRow) {
      return false;
    }
    const bounds = playerBounds(this.positionValue);
    const slotIndex = RIVER_HOPPER_GOAL_COLUMNS.findIndex(
      (_column, index) => overlapArea(bounds, goalBounds(index)) > 0,
    );
    if (slotIndex < 0 || this.filledGoalsValue[slotIndex] === true) {
      this.loseLife("closed-goal", events);
      return true;
    }

    const timeBonus = Math.floor(this.timeRemainingValue) * RIVER_HOPPER_SCORING.timeSecond;
    const points = RIVER_HOPPER_SCORING.goalBase + timeBonus;
    this.scoreValue += points;
    const filled = [...this.filledGoalsValue];
    filled[slotIndex] = true;
    this.filledGoalsValue = Object.freeze(filled);
    events.push(
      Object.freeze({ type: "goal-filled", slotIndex, points, timeBonus }),
    );

    if (filled.every(Boolean)) {
      const clearedRound = this.roundValue;
      const bonus = riverHopperRoundBonus(clearedRound);
      this.scoreValue += bonus;
      this.roundValue += 1;
      this.filledGoalsValue = Object.freeze(RIVER_HOPPER_GOAL_COLUMNS.map(() => false));
      this.lanesValue = this.createStageLanes();
      this.respawnPlayer();
      this.timeRemainingValue = this.timerForRound();
      events.push(
        Object.freeze({
          type: "round-cleared",
          round: clearedRound,
          bonus,
          nextRound: this.roundValue,
          nextStageId: this.stage.id,
        }),
      );
      return true;
    }

    this.respawnPlayer();
    this.timeRemainingValue = this.timerForRound();
    return true;
  }

  private loseLife(
    reason: RiverHopperLifeLossReason,
    events: RiverHopperSimulationEvent[],
  ): void {
    const collisionPosition = this.positionValue;
    this.livesValue -= 1;
    events.push(
      Object.freeze({
        type: "life-lost",
        reason,
        livesRemaining: this.livesValue,
        position: collisionPosition,
      }),
    );
    if (this.livesValue <= 0) {
      this.gameOverValue = true;
      this.activeHop = null;
      this.bufferedDirectionValue = null;
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      return;
    }
    this.respawnPlayer();
    this.timeRemainingValue = this.timerForRound();
  }

  private respawnPlayer(): void {
    this.positionValue = freezePosition(
      RIVER_HOPPER_RUN_RULES.logicalWidth / 2,
      riverHopperRowCenter(RIVER_HOPPER_RUN_RULES.startRow),
    );
    this.rowValue = RIVER_HOPPER_RUN_RULES.startRow;
    this.activeHop = null;
    this.bufferedDirectionValue = null;
    this.furthestRowThisLife = RIVER_HOPPER_RUN_RULES.startRow;
  }

  private createStageLanes(): readonly RiverHopperLaneState[] {
    return Object.freeze(this.stage.lanes.map(createRiverHopperLane));
  }

  private currentSpeedScale(): number {
    const difficultyScale = RIVER_HOPPER_DIFFICULTIES[this.options.difficulty].laneSpeedScale;
    const roundScale = Math.min(
      RIVER_HOPPER_RUN_RULES.maxRoundSpeedScale,
      1 + (this.roundValue - 1) * RIVER_HOPPER_RUN_RULES.roundSpeedStep,
    );
    return difficultyScale * roundScale;
  }

  private timerForRound(): number {
    const profile = RIVER_HOPPER_DIFFICULTIES[this.options.difficulty];
    const drops = Math.floor((this.roundValue - 1) / RIVER_HOPPER_RUN_RULES.timerDropEveryRounds);
    return Math.max(
      profile.minimumTimeSeconds,
      profile.timeSeconds - drops * RIVER_HOPPER_RUN_RULES.timerDropSeconds,
    );
  }
}
