import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  BARREL_CLIMBER_DIFFICULTIES,
  BARREL_CLIMBER_RUN_RULES,
  BARREL_CLIMBER_SCORING,
  barrelClimberStageClearScore,
  type BarrelClimberDifficultyId,
} from "./design.js";
import {
  createBarrelClimberHazard,
  stepBarrelClimberHazard,
  type BarrelClimberHazard,
} from "./hazards.js";
import {
  createBarrelClimberPlayer,
  stepBarrelClimberPlayer,
  type BarrelClimberPlayerInput,
  type BarrelClimberPlayerState,
} from "./player.js";
import {
  BARREL_CLIMBER_STAGES,
  type BarrelClimberStage,
} from "./stages.js";

export type BarrelClimberFrameInput = BarrelClimberPlayerInput;

export type BarrelClimberSimulationEvent =
  | { readonly type: "jumped"; readonly position: Vector2 }
  | { readonly type: "hazard-spawned"; readonly position: Vector2 }
  | {
      readonly type: "hazard-vaulted";
      readonly hazardId: number;
      readonly points: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "player-hit";
      readonly livesRemaining: number;
      readonly position: Vector2;
    }
  | {
      readonly type: "stage-cleared";
      readonly stageIndex: number;
      readonly level: number;
      readonly bonus: number;
      readonly position: Vector2;
    }
  | { readonly type: "game-over"; readonly score: number };

export interface BarrelClimberSimulationOptions {
  readonly rng: RandomService;
  readonly difficulty: BarrelClimberDifficultyId;
  readonly initialStageIndex?: number;
  readonly initialLevel?: number;
  readonly initialLives?: number;
  readonly initialHazards?: readonly BarrelClimberHazard[];
  readonly initialPlayer?: BarrelClimberPlayerState;
  readonly initialSpawnDelaySeconds?: number;
  readonly initialInvulnerabilitySeconds?: number;
}

const PLAYER_HALF_WIDTH = BARREL_CLIMBER_RUN_RULES.playerWidth / 2;
const PLAYER_HEIGHT = BARREL_CLIMBER_RUN_RULES.playerHeight;

function playerCenter(player: BarrelClimberPlayerState): Vector2 {
  return Object.freeze({ x: player.x, y: player.y - PLAYER_HEIGHT / 2 });
}

function intersectsHazard(player: BarrelClimberPlayerState, hazard: BarrelClimberHazard): boolean {
  const radius = BARREL_CLIMBER_RUN_RULES.hazardRadius;
  const left = player.x - PLAYER_HALF_WIDTH;
  const right = player.x + PLAYER_HALF_WIDTH;
  const top = player.y - PLAYER_HEIGHT;
  const bottom = player.y;
  const closestX = Math.max(left, Math.min(hazard.x, right));
  const closestY = Math.max(top, Math.min(hazard.y, bottom));
  const dx = hazard.x - closestX;
  const dy = hazard.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

export class BarrelClimberSimulation {
  private stageIndexValue: number;
  private levelValue: number;
  private livesValue: number;
  private scoreValue = 0;
  private playerState: BarrelClimberPlayerState;
  private hazardState: readonly BarrelClimberHazard[];
  private spawnCountdownSeconds: number;
  private invulnerabilitySecondsValue: number;
  private nextHazardId = 1;
  private gameOverValue = false;
  private readonly vaultedThisJump = new Set<number>();

  public constructor(private readonly options: BarrelClimberSimulationOptions) {
    this.stageIndexValue = options.initialStageIndex ?? 0;
    if (!Number.isSafeInteger(this.stageIndexValue) || this.stageIndexValue < 0 || this.stageIndexValue >= BARREL_CLIMBER_STAGES.length) {
      throw new RangeError("initialStageIndex must reference a Barrel Climber stage");
    }
    this.levelValue = options.initialLevel ?? 1;
    requirePositiveInteger(this.levelValue, "initialLevel");
    this.livesValue = options.initialLives ?? BARREL_CLIMBER_RUN_RULES.startingLives;
    requirePositiveInteger(this.livesValue, "initialLives");
    this.playerState = options.initialPlayer ?? createBarrelClimberPlayer(this.stage);
    this.hazardState = Object.freeze(
      options.initialHazards === undefined
        ? [createBarrelClimberHazard(this.stage, 1)]
        : [...options.initialHazards],
    );
    this.nextHazardId = this.hazardState.reduce((maximum, hazard) => Math.max(maximum, hazard.id + 1), 1);
    this.spawnCountdownSeconds = options.initialSpawnDelaySeconds ?? this.spawnIntervalSeconds();
    if (!Number.isFinite(this.spawnCountdownSeconds) || this.spawnCountdownSeconds < 0) {
      throw new RangeError("initialSpawnDelaySeconds must be non-negative and finite");
    }
    this.invulnerabilitySecondsValue =
      options.initialInvulnerabilitySeconds ?? BARREL_CLIMBER_DIFFICULTIES[options.difficulty].spawnProtectionSeconds;
    if (!Number.isFinite(this.invulnerabilitySecondsValue) || this.invulnerabilitySecondsValue < 0) {
      throw new RangeError("initialInvulnerabilitySeconds must be non-negative and finite");
    }
  }

  public get stage(): BarrelClimberStage {
    const stage = BARREL_CLIMBER_STAGES[this.stageIndexValue];
    if (stage === undefined) {
      throw new Error("Barrel Climber stage index is out of bounds");
    }
    return stage;
  }

  public get stageIndex(): number {
    return this.stageIndexValue;
  }

  public get level(): number {
    return this.levelValue;
  }

  public get lives(): number {
    return this.livesValue;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get player(): BarrelClimberPlayerState {
    return this.playerState;
  }

  public get hazards(): readonly BarrelClimberHazard[] {
    return this.hazardState;
  }

  public get invulnerabilitySeconds(): number {
    return this.invulnerabilitySecondsValue;
  }

  public get gameOver(): boolean {
    return this.gameOverValue;
  }

  public update(input: BarrelClimberFrameInput, dtSeconds: number): readonly BarrelClimberSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    if (this.gameOverValue) {
      return Object.freeze([]);
    }

    const events: BarrelClimberSimulationEvent[] = [];
    const playerStep = stepBarrelClimberPlayer(this.stage, this.playerState, input, dtSeconds);
    this.playerState = playerStep.state;
    if (playerStep.jumped) {
      this.vaultedThisJump.clear();
      events.push(Object.freeze({ type: "jumped", position: playerCenter(this.playerState) }));
    }
    if (playerStep.landed) {
      this.vaultedThisJump.clear();
    }

    this.stepHazards(dtSeconds);
    this.spawnCountdownSeconds -= dtSeconds;
    if (this.spawnCountdownSeconds <= 0 && this.hazardState.length < BARREL_CLIMBER_RUN_RULES.maxHazards) {
      const hazard = createBarrelClimberHazard(this.stage, this.nextHazardId);
      this.nextHazardId += 1;
      this.hazardState = Object.freeze([...this.hazardState, hazard]);
      this.spawnCountdownSeconds = this.spawnIntervalSeconds();
      events.push(Object.freeze({ type: "hazard-spawned", position: Object.freeze({ x: hazard.x, y: hazard.y }) }));
    }

    this.invulnerabilitySecondsValue = Math.max(0, this.invulnerabilitySecondsValue - dtSeconds);
    this.resolveVaults(events);
    this.resolvePlayerHit(events);
    this.resolveGoal(events);
    return Object.freeze(events);
  }

  private speedScale(): number {
    const base = BARREL_CLIMBER_DIFFICULTIES[this.options.difficulty].hazardSpeedScale;
    return Math.min(1.62, base * (1 + (this.levelValue - 1) * 0.065));
  }

  private spawnIntervalSeconds(): number {
    const base = BARREL_CLIMBER_DIFFICULTIES[this.options.difficulty].spawnIntervalSeconds;
    return Math.max(1.15, base - (this.levelValue - 1) * 0.11);
  }

  private stepHazards(dtSeconds: number): void {
    const profile = BARREL_CLIMBER_DIFFICULTIES[this.options.difficulty];
    const stepped: BarrelClimberHazard[] = [];
    for (const hazard of this.hazardState) {
      const next = stepBarrelClimberHazard(this.stage, hazard, dtSeconds, {
        speedScale: this.speedScale(),
        ladderDropScale: profile.ladderDropScale,
        rng: this.options.rng,
      });
      if (next !== null) {
        stepped.push(next);
      }
    }
    this.hazardState = Object.freeze(stepped.slice(0, BARREL_CLIMBER_RUN_RULES.maxHazards));
  }

  private resolveVaults(events: BarrelClimberSimulationEvent[]): void {
    if (this.playerState.mode !== "airborne") {
      return;
    }
    const hazardRadius = BARREL_CLIMBER_RUN_RULES.hazardRadius;
    for (const hazard of this.hazardState) {
      if (this.vaultedThisJump.has(hazard.id)) {
        continue;
      }
      const horizontallyClose = Math.abs(this.playerState.x - hazard.x) <= hazardRadius + PLAYER_HALF_WIDTH + 1;
      const feetAboveHazard = this.playerState.y <= hazard.y - hazardRadius + 1;
      // CR-007: the "feet above" approximation above and the precise circle-rect hit test used by
      // resolvePlayerHit overlap in a real band near minimum jump clearance -- a narrowly-cleared
      // jump could satisfy both simultaneously and get credited with vaulting the hazard while
      // also losing a life to it, in the same frame. Make intersectsHazard (the same test
      // resolvePlayerHit uses) the tie-breaker: only award the vault when this hazard is NOT
      // currently intersecting, so the two outcomes stay mutually exclusive for a given hazard.
      if (!horizontallyClose || !feetAboveHazard || intersectsHazard(this.playerState, hazard)) {
        continue;
      }
      this.vaultedThisJump.add(hazard.id);
      const points = BARREL_CLIMBER_SCORING.vaultHazard;
      this.scoreValue += points;
      events.push(Object.freeze({
        type: "hazard-vaulted",
        hazardId: hazard.id,
        points,
        position: Object.freeze({ x: hazard.x, y: hazard.y }),
      }));
    }
  }

  private resolvePlayerHit(events: BarrelClimberSimulationEvent[]): void {
    if (this.invulnerabilitySecondsValue > 0) {
      return;
    }
    const hit = this.hazardState.find((hazard) => intersectsHazard(this.playerState, hazard));
    if (hit === undefined) {
      return;
    }
    const position = playerCenter(this.playerState);
    this.livesValue -= 1;
    events.push(Object.freeze({ type: "player-hit", livesRemaining: this.livesValue, position }));
    if (this.livesValue <= 0) {
      this.gameOverValue = true;
      this.hazardState = Object.freeze([]);
      events.push(Object.freeze({ type: "game-over", score: this.scoreValue }));
      return;
    }
    this.resetStageRunState();
  }

  private resolveGoal(events: BarrelClimberSimulationEvent[]): void {
    if (this.gameOverValue || this.playerState.mode !== "grounded" || this.playerState.platformId !== this.stage.goal.platformId) {
      return;
    }
    if (Math.abs(this.playerState.x - this.stage.goal.x) > this.stage.goal.width / 2) {
      return;
    }
    const clearedStageIndex = this.stageIndexValue;
    const clearedLevel = this.levelValue;
    const bonus = barrelClimberStageClearScore(clearedStageIndex, clearedLevel);
    this.scoreValue += bonus;
    events.push(Object.freeze({
      type: "stage-cleared",
      stageIndex: clearedStageIndex,
      level: clearedLevel,
      bonus,
      position: Object.freeze({ x: this.stage.goal.x, y: this.playerState.y - PLAYER_HEIGHT }),
    }));
    this.stageIndexValue += 1;
    if (this.stageIndexValue >= BARREL_CLIMBER_STAGES.length) {
      this.stageIndexValue = 0;
      this.levelValue += 1;
    }
    this.resetStageRunState();
  }

  private resetStageRunState(): void {
    this.playerState = createBarrelClimberPlayer(this.stage);
    this.hazardState = Object.freeze([]);
    this.vaultedThisJump.clear();
    this.spawnCountdownSeconds = this.spawnIntervalSeconds();
    this.invulnerabilitySecondsValue = BARREL_CLIMBER_DIFFICULTIES[this.options.difficulty].spawnProtectionSeconds;
  }
}
