import type { PointerSnapshot, Vector2 } from "../../engine/index.js";
import { MISSILE_DEFENSE_RUN_RULES } from "./design.js";

export interface MissileDefenseCursorInput {
  readonly xAxis: -1 | 0 | 1;
  readonly yAxis: -1 | 0 | 1;
  readonly pointer: PointerSnapshot;
}

export function createMissileDefenseCursor(): Vector2 {
  return Object.freeze({
    x: MISSILE_DEFENSE_RUN_RULES.logicalWidth / 2,
    y: MISSILE_DEFENSE_RUN_RULES.logicalHeight / 2,
  });
}

export function stepMissileDefenseCursor(
  current: Vector2,
  input: MissileDefenseCursorInput,
  dtSeconds: number,
): Vector2 {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }

  if (input.pointer.inside && input.pointer.position !== null) {
    return Object.freeze({
      x: clamp(input.pointer.position.x, 0, MISSILE_DEFENSE_RUN_RULES.logicalWidth),
      y: clamp(
        input.pointer.position.y,
        MISSILE_DEFENSE_RUN_RULES.cursorMinY,
        MISSILE_DEFENSE_RUN_RULES.cursorMaxY,
      ),
    });
  }

  const length = Math.hypot(input.xAxis, input.yAxis);
  const scale = length > 1 ? 1 / length : 1;
  return Object.freeze({
    x: clamp(
      current.x + input.xAxis * scale * MISSILE_DEFENSE_RUN_RULES.cursorSpeed * dtSeconds,
      0,
      MISSILE_DEFENSE_RUN_RULES.logicalWidth,
    ),
    y: clamp(
      current.y + input.yAxis * scale * MISSILE_DEFENSE_RUN_RULES.cursorSpeed * dtSeconds,
      MISSILE_DEFENSE_RUN_RULES.cursorMinY,
      MISSILE_DEFENSE_RUN_RULES.cursorMaxY,
    ),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
