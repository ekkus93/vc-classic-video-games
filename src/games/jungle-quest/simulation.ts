import { intersectsAabb, type Aabb, type Vector2 } from "../../engine/index.js";
import { JUNGLE_QUEST_DIFFICULTIES, JUNGLE_QUEST_RUN_RULES, JUNGLE_QUEST_SCORING, type JungleQuestDifficultyId } from "./design.js";
import { createJungleQuestPlayer, stepJungleQuestPlayer, type JungleQuestPlayerInput, type JungleQuestPlayerState } from "./player.js";
import { JUNGLE_QUEST_FINISH_ROOM, JUNGLE_QUEST_FINISH_X, JUNGLE_QUEST_START_ROOM, JUNGLE_QUEST_TOTAL_COLLECTIBLES, jungleQuestRoom, type JungleQuestCheckpoint, type JungleQuestRoom, type JungleQuestRoomId } from "./world.js";

export type JungleQuestRunEndReason = "completed" | "out-of-lives" | "time-expired";
export type JungleQuestSimulationEvent =
  | { readonly type: "jumped"; readonly position: Vector2 }
  | { readonly type: "vine-latched"; readonly position: Vector2 }
  | { readonly type: "vine-released"; readonly position: Vector2 }
  | { readonly type: "room-changed"; readonly from: JungleQuestRoomId; readonly to: JungleQuestRoomId }
  | { readonly type: "checkpoint"; readonly roomId: JungleQuestRoomId; readonly points: number; readonly position: Vector2 }
  | { readonly type: "relic-collected"; readonly id: string; readonly points: number; readonly position: Vector2 }
  | { readonly type: "player-hit"; readonly livesRemaining: number; readonly position: Vector2 }
  | { readonly type: "run-ended"; readonly reason: JungleQuestRunEndReason; readonly score: number; readonly bonus: number };
export interface JungleQuestSimulationOptions {
  readonly difficulty: JungleQuestDifficultyId; readonly initialRoomId?: JungleQuestRoomId; readonly initialPlayer?: JungleQuestPlayerState;
  readonly initialLives?: number; readonly initialScore?: number; readonly initialElapsedSeconds?: number; readonly initialInvulnerabilitySeconds?: number; readonly collectedIds?: readonly string[];
}
interface RespawnPoint { readonly roomId: JungleQuestRoomId; readonly position: Vector2; }
const HALF_WIDTH = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
const HALF_HEIGHT = JUNGLE_QUEST_RUN_RULES.playerHeight / 2;
function playerAabb(player: JungleQuestPlayerState): Aabb { return { x: player.position.x - HALF_WIDTH, y: player.position.y - HALF_HEIGHT, width: JUNGLE_QUEST_RUN_RULES.playerWidth, height: JUNGLE_QUEST_RUN_RULES.playerHeight }; }
function collectibleAabb(x: number, y: number): Aabb { return { x: x - 5, y: y - 5, width: 10, height: 10 }; }
function spawnForCheckpoint(roomId: JungleQuestRoomId, checkpoint: JungleQuestCheckpoint): RespawnPoint { return Object.freeze({ roomId, position: Object.freeze({ x: checkpoint.x, y: checkpoint.y }) }); }

export class JungleQuestSimulation {
  private roomIdValue: JungleQuestRoomId; private playerValue: JungleQuestPlayerState; private livesValue: number; private scoreValue: number;
  private elapsedSecondsValue: number; private invulnerabilitySecondsValue: number; private readonly collected = new Set<string>();
  private checkpointValue: RespawnPoint; private endedValue = false; private endReasonValue: JungleQuestRunEndReason | null = null;
  public constructor(private readonly options: JungleQuestSimulationOptions) {
    const profile = JUNGLE_QUEST_DIFFICULTIES[options.difficulty];
    this.roomIdValue = options.initialRoomId ?? JUNGLE_QUEST_START_ROOM;
    const room = jungleQuestRoom(this.roomIdValue);
    const initialCheckpoint = room.checkpoint ?? jungleQuestRoom(JUNGLE_QUEST_START_ROOM).checkpoint;
    if (initialCheckpoint === null) throw new Error("Jungle Quest start room requires a checkpoint");
    this.checkpointValue = spawnForCheckpoint(room.checkpoint === null ? JUNGLE_QUEST_START_ROOM : room.id, initialCheckpoint);
    this.playerValue = options.initialPlayer ?? createJungleQuestPlayer(this.checkpointValue.position);
    this.livesValue = options.initialLives ?? profile.startingLives; this.scoreValue = options.initialScore ?? 0;
    this.elapsedSecondsValue = options.initialElapsedSeconds ?? 0; this.invulnerabilitySecondsValue = options.initialInvulnerabilitySeconds ?? 0;
    for (const id of options.collectedIds ?? []) this.collected.add(id);
    if (!Number.isSafeInteger(this.livesValue) || this.livesValue <= 0) throw new RangeError("initialLives must be a positive safe integer");
    if (!Number.isSafeInteger(this.scoreValue) || this.scoreValue < 0) throw new RangeError("initialScore must be a non-negative safe integer");
    if (!Number.isFinite(this.elapsedSecondsValue) || this.elapsedSecondsValue < 0) throw new RangeError("initialElapsedSeconds must be non-negative and finite");
    if (!Number.isFinite(this.invulnerabilitySecondsValue) || this.invulnerabilitySecondsValue < 0) throw new RangeError("initialInvulnerabilitySeconds must be non-negative and finite");
  }
  public get roomId(): JungleQuestRoomId { return this.roomIdValue; }
  public get room(): JungleQuestRoom { return jungleQuestRoom(this.roomIdValue); }
  public get player(): JungleQuestPlayerState { return this.playerValue; }
  public get lives(): number { return this.livesValue; }
  public get score(): number { return this.scoreValue; }
  public get elapsedSeconds(): number { return this.elapsedSecondsValue; }
  public get timeRemainingSeconds(): number { return Math.max(0, JUNGLE_QUEST_DIFFICULTIES[this.options.difficulty].timeLimitSeconds - this.elapsedSecondsValue); }
  public get invulnerabilitySeconds(): number { return this.invulnerabilitySecondsValue; }
  public get ended(): boolean { return this.endedValue; }
  public get endReason(): JungleQuestRunEndReason | null { return this.endReasonValue; }
  public get collectedCount(): number { return this.collected.size; }
  public hasCollected(id: string): boolean { return this.collected.has(id); }
  public update(input: JungleQuestPlayerInput, dtSeconds: number): readonly JungleQuestSimulationEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError("dtSeconds must be a non-negative finite number");
    if (this.endedValue) return Object.freeze([]);
    const events: JungleQuestSimulationEvent[] = [];
    this.elapsedSecondsValue += dtSeconds;
    this.invulnerabilitySecondsValue = Math.max(0, this.invulnerabilitySecondsValue - dtSeconds);
    if (this.timeRemainingSeconds <= 0) { this.endRun("time-expired", 0, events); return Object.freeze(events); }
    const stepped = stepJungleQuestPlayer(this.playerValue, input, this.room, dtSeconds); this.playerValue = stepped.state; events.push(...stepped.events);
    this.resolveRoomTransition(events); this.resolveCollectibles(events); if (this.resolveHazards(events)) return Object.freeze(events); this.resolveCompletion(events);
    return Object.freeze(events);
  }
  private resolveRoomTransition(events: JungleQuestSimulationEvent[]): void {
    const room = this.room; let target: JungleQuestRoomId | null = null; let x = this.playerValue.position.x;
    if (x > JUNGLE_QUEST_RUN_RULES.logicalWidth + HALF_WIDTH) { target = room.next; x = HALF_WIDTH + 1; }
    else if (x < -HALF_WIDTH) { target = room.previous; x = JUNGLE_QUEST_RUN_RULES.logicalWidth - HALF_WIDTH - 1; }
    if (target === null) {
      // CR-001: only clamp against an edge with no adjoining room to travel into. Clamping the
      // near-edge position back to the on-screen bound every frame (as this used to do
      // unconditionally) fights the transition trigger above: it never lets position accumulate
      // past the visible edge toward the trigger threshold, so a room with a real neighbor could
      // never actually be crossed by real input. A room boundary that leads nowhere (no
      // `previous`/`next`) still needs the clamp so the player can't run off-screen forever.
      const minX = room.previous === null ? HALF_WIDTH : -Infinity;
      const maxX = room.next === null ? JUNGLE_QUEST_RUN_RULES.logicalWidth - HALF_WIDTH : Infinity;
      const clampedX = Math.max(minX, Math.min(maxX, this.playerValue.position.x));
      if (clampedX !== this.playerValue.position.x) {
        this.playerValue = Object.freeze({ ...this.playerValue, position: Object.freeze({ x: clampedX, y: this.playerValue.position.y }) });
      }
      return;
    }
    const from = this.roomIdValue; this.roomIdValue = target;
    this.playerValue = Object.freeze({ ...this.playerValue, position: Object.freeze({ x, y: this.playerValue.position.y }), mode: this.playerValue.mode === "vine" || this.playerValue.mode === "ladder" ? "air" : this.playerValue.mode, vineId: null, vineAngleRadians: 0, vineAngularVelocity: 0 });
    events.push(Object.freeze({ type: "room-changed", from, to: target }));
    const checkpoint = this.room.checkpoint;
    if (checkpoint !== null && this.checkpointValue.roomId !== target) {
      this.checkpointValue = spawnForCheckpoint(target, checkpoint); this.scoreValue += JUNGLE_QUEST_SCORING.checkpoint;
      events.push(Object.freeze({ type: "checkpoint", roomId: target, points: JUNGLE_QUEST_SCORING.checkpoint, position: this.checkpointValue.position }));
    }
  }
  private resolveCollectibles(events: JungleQuestSimulationEvent[]): void {
    const playerBox = playerAabb(this.playerValue);
    for (const collectible of this.room.collectibles) {
      if (this.collected.has(collectible.id) || !intersectsAabb(playerBox, collectibleAabb(collectible.x, collectible.y))) continue;
      this.collected.add(collectible.id); this.scoreValue += JUNGLE_QUEST_SCORING.relic;
      events.push(Object.freeze({ type: "relic-collected", id: collectible.id, points: JUNGLE_QUEST_SCORING.relic, position: Object.freeze({ x: collectible.x, y: collectible.y }) }));
    }
  }
  private resolveHazards(events: JungleQuestSimulationEvent[]): boolean {
    const fellOut = this.playerValue.position.y - HALF_HEIGHT > JUNGLE_QUEST_RUN_RULES.logicalHeight;
    if (!fellOut && this.invulnerabilitySecondsValue > 0) return false;
    const hitHazard = this.room.hazards.some((hazard) => intersectsAabb(playerAabb(this.playerValue), hazard));
    if (!fellOut && !hitHazard) return false;
    const position = this.playerValue.position; this.livesValue -= 1; this.scoreValue = Math.max(0, this.scoreValue - JUNGLE_QUEST_SCORING.hazardPenalty);
    events.push(Object.freeze({ type: "player-hit", livesRemaining: this.livesValue, position }));
    if (this.livesValue <= 0) { this.endRun("out-of-lives", 0, events); return true; }
    this.roomIdValue = this.checkpointValue.roomId; this.playerValue = createJungleQuestPlayer(this.checkpointValue.position);
    this.invulnerabilitySecondsValue = JUNGLE_QUEST_DIFFICULTIES[this.options.difficulty].respawnProtectionSeconds; return true;
  }
  private resolveCompletion(events: JungleQuestSimulationEvent[]): void {
    if (this.roomIdValue !== JUNGLE_QUEST_FINISH_ROOM || this.playerValue.position.x < JUNGLE_QUEST_FINISH_X || this.playerValue.position.y + HALF_HEIGHT > 194 || this.collected.size !== JUNGLE_QUEST_TOTAL_COLLECTIBLES) return;
    const timeBonus = Math.floor(this.timeRemainingSeconds) * JUNGLE_QUEST_SCORING.remainingSecond; const lifeBonus = this.livesValue * JUNGLE_QUEST_SCORING.remainingLife;
    const bonus = JUNGLE_QUEST_SCORING.completion + timeBonus + lifeBonus; this.scoreValue += bonus; this.endRun("completed", bonus, events);
  }
  private endRun(reason: JungleQuestRunEndReason, bonus: number, events: JungleQuestSimulationEvent[]): void {
    if (this.endedValue) return; this.endedValue = true; this.endReasonValue = reason;
    events.push(Object.freeze({ type: "run-ended", reason, score: this.scoreValue, bonus }));
  }
}
