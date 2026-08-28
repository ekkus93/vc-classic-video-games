import { wrapCoordinate, type Vector2 } from "../../engine/index.js";
import { SPACE_ROCKS_RUN_RULES } from "./design.js";

export function wrapSpaceRocksPosition(position: Vector2): Vector2 {
  return Object.freeze({
    x: wrapCoordinate(position.x, SPACE_ROCKS_RUN_RULES.logicalWidth),
    y: wrapCoordinate(position.y, SPACE_ROCKS_RUN_RULES.logicalHeight),
  });
}

export function advanceWrappedSpaceRocksPosition(
  position: Vector2,
  velocity: Vector2,
  dtSeconds: number,
): Vector2 {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
  return wrapSpaceRocksPosition({
    x: position.x + velocity.x * dtSeconds,
    y: position.y + velocity.y * dtSeconds,
  });
}

export function wrappedSpaceRocksDistanceSquared(
  a: Vector2,
  b: Vector2,
): number {
  const rawDx = Math.abs(a.x - b.x);
  const rawDy = Math.abs(a.y - b.y);
  const dx = Math.min(rawDx, SPACE_ROCKS_RUN_RULES.logicalWidth - rawDx);
  const dy = Math.min(rawDy, SPACE_ROCKS_RUN_RULES.logicalHeight - rawDy);
  return dx * dx + dy * dy;
}
