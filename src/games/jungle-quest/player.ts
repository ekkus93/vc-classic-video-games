import type { Vector2 } from "../../engine/index.js";
import { JUNGLE_QUEST_RUN_RULES } from "./design.js";
import type { JungleQuestLadder, JungleQuestRoom, JungleQuestVine } from "./world.js";

export type JungleQuestPlayerMode = "ground" | "air" | "ladder" | "vine";
export interface JungleQuestPlayerState {
  readonly position: Vector2; readonly velocity: Vector2; readonly facing: -1 | 1; readonly mode: JungleQuestPlayerMode;
  readonly vineId: string | null; readonly vineAngleRadians: number; readonly vineAngularVelocity: number;
}
export interface JungleQuestPlayerInput { readonly horizontal: -1 | 0 | 1; readonly vertical: -1 | 0 | 1; readonly jumpPressed: boolean; readonly vinePressed: boolean; }
export type JungleQuestPlayerEvent =
  | { readonly type: "jumped"; readonly position: Vector2 }
  | { readonly type: "vine-latched"; readonly position: Vector2 }
  | { readonly type: "vine-released"; readonly position: Vector2 };
export interface JungleQuestPlayerStep { readonly state: JungleQuestPlayerState; readonly events: readonly JungleQuestPlayerEvent[]; }

const HALF_WIDTH = JUNGLE_QUEST_RUN_RULES.playerWidth / 2;
const HALF_HEIGHT = JUNGLE_QUEST_RUN_RULES.playerHeight / 2;
const LADDER_SNAP_DISTANCE = 9;
const VINE_LATCH_DISTANCE = 28;
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function moveToward(value: number, target: number, delta: number): number { if (value < target) return Math.min(target, value + delta); if (value > target) return Math.max(target, value - delta); return target; }
function ladderNear(room: JungleQuestRoom, position: Vector2): JungleQuestLadder | null {
  return room.ladders.find((ladder) => Math.abs(position.x - ladder.x) <= LADDER_SNAP_DISTANCE && position.y + HALF_HEIGHT >= ladder.yTop - 4 && position.y + HALF_HEIGHT <= ladder.yBottom + 4) ?? null;
}
function vineById(room: JungleQuestRoom, id: string | null): JungleQuestVine | null { if (id === null) return null; return room.vines.find((vine) => vine.id === id) ?? null; }
function latchableVine(room: JungleQuestRoom, position: Vector2): JungleQuestVine | null {
  return room.vines.find((vine) => Math.hypot(position.x - vine.anchorX, position.y - (vine.anchorY + vine.length)) <= VINE_LATCH_DISTANCE) ?? null;
}
function standingPlatformY(room: JungleQuestRoom, position: Vector2): number | null {
  const feet = position.y + HALF_HEIGHT;
  const platform = room.platforms.find((candidate) => position.x + HALF_WIDTH >= candidate.x1 && position.x - HALF_WIDTH <= candidate.x2 && Math.abs(feet - candidate.y) <= 1e-6);
  return platform?.y ?? null;
}
function resolveLanding(room: JungleQuestRoom, previous: Vector2, next: Vector2, velocityY: number): { readonly y: number; readonly landed: boolean } {
  if (velocityY < 0) return { y: next.y, landed: false };
  const previousFeet = previous.y + HALF_HEIGHT; const nextFeet = next.y + HALF_HEIGHT; let landingY: number | null = null;
  for (const platform of room.platforms) {
    if (next.x + HALF_WIDTH < platform.x1 || next.x - HALF_WIDTH > platform.x2 || previousFeet > platform.y + 0.5 || nextFeet < platform.y) continue;
    if (landingY === null || platform.y < landingY) landingY = platform.y;
  }
  return landingY === null ? { y: next.y, landed: false } : { y: landingY - HALF_HEIGHT, landed: true };
}
function enterLadder(state: JungleQuestPlayerState, ladder: JungleQuestLadder): JungleQuestPlayerState {
  return Object.freeze({ ...state, position: Object.freeze({ x: ladder.x, y: state.position.y }), velocity: Object.freeze({ x: 0, y: 0 }), mode: "ladder", vineId: null });
}
function stepLadder(state: JungleQuestPlayerState, ladder: JungleQuestLadder, input: JungleQuestPlayerInput, dtSeconds: number): JungleQuestPlayerState {
  const topY = ladder.yTop - HALF_HEIGHT; const bottomY = ladder.yBottom - HALF_HEIGHT;
  const y = clamp(state.position.y + input.vertical * JUNGLE_QUEST_RUN_RULES.climbSpeed * dtSeconds, topY, bottomY);
  const atEnd = y === topY || y === bottomY;
  return Object.freeze({ ...state, position: Object.freeze({ x: ladder.x, y }), velocity: Object.freeze({ x: 0, y: input.vertical * JUNGLE_QUEST_RUN_RULES.climbSpeed }), mode: atEnd && input.vertical !== 0 ? "ground" : "ladder" });
}
function stepVine(state: JungleQuestPlayerState, vine: JungleQuestVine, input: JungleQuestPlayerInput, dtSeconds: number): JungleQuestPlayerStep {
  const events: JungleQuestPlayerEvent[] = [];
  const gravityAngular = -(JUNGLE_QUEST_RUN_RULES.gravity / vine.length) * Math.sin(state.vineAngleRadians);
  const pumpAngular = input.horizontal * JUNGLE_QUEST_RUN_RULES.vinePumpAcceleration;
  let angularVelocity = state.vineAngularVelocity + (gravityAngular + pumpAngular) * dtSeconds;
  angularVelocity *= Math.max(0, 1 - 0.35 * dtSeconds);
  angularVelocity = clamp(angularVelocity, -JUNGLE_QUEST_RUN_RULES.maxVineAngularSpeed, JUNGLE_QUEST_RUN_RULES.maxVineAngularSpeed);
  let angle = state.vineAngleRadians + angularVelocity * dtSeconds;
  const limit = JUNGLE_QUEST_RUN_RULES.maxVineAngleRadians;
  if (angle < -limit || angle > limit) { angle = clamp(angle, -limit, limit); angularVelocity *= -0.35; }
  const position = Object.freeze({ x: vine.anchorX + Math.sin(angle) * vine.length, y: vine.anchorY + Math.cos(angle) * vine.length });
  if (input.jumpPressed || input.vinePressed) {
    const velocity = Object.freeze({ x: Math.cos(angle) * vine.length * angularVelocity + input.horizontal * 12, y: -Math.sin(angle) * vine.length * angularVelocity - 22 });
    events.push(Object.freeze({ type: "vine-released", position }));
    return Object.freeze({ state: Object.freeze({ ...state, position, velocity, mode: "air", vineId: null, vineAngleRadians: 0, vineAngularVelocity: 0 }), events: Object.freeze(events) });
  }
  return Object.freeze({ state: Object.freeze({ ...state, position, velocity: Object.freeze({ x: 0, y: 0 }), facing: input.horizontal === 0 ? state.facing : input.horizontal, mode: "vine", vineId: vine.id, vineAngleRadians: angle, vineAngularVelocity: angularVelocity }), events: Object.freeze(events) });
}
export function createJungleQuestPlayer(position: Vector2): JungleQuestPlayerState {
  return Object.freeze({ position: Object.freeze({ ...position }), velocity: Object.freeze({ x: 0, y: 0 }), facing: 1, mode: "ground", vineId: null, vineAngleRadians: 0, vineAngularVelocity: 0 });
}
export function stepJungleQuestPlayer(state: JungleQuestPlayerState, input: JungleQuestPlayerInput, room: JungleQuestRoom, dtSeconds: number): JungleQuestPlayerStep {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError("dtSeconds must be a non-negative finite number");
  const activeVine = vineById(room, state.vineId);
  if (state.mode === "vine" && activeVine !== null) return stepVine(state, activeVine, input, dtSeconds);
  const activeLadder = ladderNear(room, state.position);
  if (state.mode === "ladder" && activeLadder !== null) return Object.freeze({ state: stepLadder(state, activeLadder, input, dtSeconds), events: Object.freeze([]) });
  // CR-002: only mount/re-mount a ladder on pure vertical intent. Without the `horizontal === 0`
  // guard, a player who has just dismounted at a ladder end (mode flipped to "ground" by
  // stepLadder's atEnd case) but is still holding a diagonal -- e.g. up+right -- would
  // immediately re-satisfy this same condition every frame (ladderNear still matches right at
  // the end), re-enter the ladder, get clamped back to the same end, and dismount again, without
  // ever reaching the horizontal-movement code below. Requiring no simultaneous horizontal input
  // lets a diagonal hold fall through to ordinary ground/air movement once dismounted, while a
  // pure vertical hold can still climb or re-approach the ladder as before.
  if (input.vertical !== 0 && input.horizontal === 0 && activeLadder !== null) { const ladderState = enterLadder(state, activeLadder); return Object.freeze({ state: stepLadder(ladderState, activeLadder, input, dtSeconds), events: Object.freeze([]) }); }
  if (input.vinePressed) {
    const vine = latchableVine(room, state.position);
    if (vine !== null) {
      const dx = state.position.x - vine.anchorX; const dy = state.position.y - vine.anchorY;
      const angle = clamp(Math.atan2(dx, dy), -JUNGLE_QUEST_RUN_RULES.maxVineAngleRadians, JUNGLE_QUEST_RUN_RULES.maxVineAngleRadians);
      const tangentX = Math.cos(angle) * vine.length; const tangentY = -Math.sin(angle) * vine.length; const tangentLengthSquared = tangentX * tangentX + tangentY * tangentY;
      const angularVelocity = tangentLengthSquared === 0 ? 0 : (state.velocity.x * tangentX + state.velocity.y * tangentY) / tangentLengthSquared;
      const position = Object.freeze({ x: vine.anchorX + Math.sin(angle) * vine.length, y: vine.anchorY + Math.cos(angle) * vine.length });
      return Object.freeze({ state: Object.freeze({ ...state, position, velocity: Object.freeze({ x: 0, y: 0 }), mode: "vine", vineId: vine.id, vineAngleRadians: angle, vineAngularVelocity: angularVelocity }), events: Object.freeze([Object.freeze({ type: "vine-latched" as const, position })]) });
    }
  }
  const events: JungleQuestPlayerEvent[] = [];
  const standingY = standingPlatformY(room, state.position);
  let mode: JungleQuestPlayerMode = standingY === null ? "air" : "ground";
  let velocityX = state.velocity.x; let velocityY = state.velocity.y;
  if (input.horizontal !== 0) velocityX = moveToward(velocityX, input.horizontal * JUNGLE_QUEST_RUN_RULES.maxRunSpeed, JUNGLE_QUEST_RUN_RULES.runAcceleration * dtSeconds);
  else if (mode === "ground") velocityX = moveToward(velocityX, 0, JUNGLE_QUEST_RUN_RULES.groundFriction * dtSeconds);
  if (mode === "ground") { velocityY = 0; if (input.jumpPressed) { velocityY = -JUNGLE_QUEST_RUN_RULES.jumpSpeed; mode = "air"; events.push(Object.freeze({ type: "jumped", position: state.position })); } }
  velocityY = Math.min(JUNGLE_QUEST_RUN_RULES.maxFallSpeed, velocityY + JUNGLE_QUEST_RUN_RULES.gravity * dtSeconds);
  const next = Object.freeze({ x: state.position.x + velocityX * dtSeconds, y: state.position.y + velocityY * dtSeconds });
  const landing = resolveLanding(room, state.position, next, velocityY);
  if (landing.landed) { mode = "ground"; velocityY = 0; }
  const facing = input.horizontal === 0 ? state.facing : input.horizontal;
  return Object.freeze({ state: Object.freeze({ position: Object.freeze({ x: next.x, y: landing.y }), velocity: Object.freeze({ x: velocityX, y: velocityY }), facing, mode, vineId: null, vineAngleRadians: 0, vineAngularVelocity: 0 }), events: Object.freeze(events) });
}
