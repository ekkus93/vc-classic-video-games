import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
} from "./design.js";

export type BugBarrageRoamerKind = "skimmer" | "mender";

export interface BugBarrageRoamer {
  readonly id: number;
  readonly kind: BugBarrageRoamerKind;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly repairCooldownSeconds: number;
}

export function spawnBugBarrageRoamer(
  rng: RandomService,
  id: number,
  existingCount: number,
  wave: number,
): BugBarrageRoamer | null {
  if (existingCount >= BUG_BARRAGE_LIMITS.maxRoamers) {
    return null;
  }
  const kind: BugBarrageRoamerKind = rng.nextFloat() < 0.58 ? "skimmer" : "mender";
  const fromLeft = rng.nextFloat() < 0.5;
  const speed = Math.min(128, 58 + wave * 4);
  if (kind === "skimmer") {
    return Object.freeze({
      id,
      kind,
      position: Object.freeze({
        x: fromLeft ? -8 : BUG_BARRAGE_RUN_RULES.logicalWidth + 8,
        y:
          BUG_BARRAGE_RUN_RULES.playerRegionTop +
          8 +
          rng.nextFloat() *
            (BUG_BARRAGE_RUN_RULES.playerRegionBottom -
              BUG_BARRAGE_RUN_RULES.playerRegionTop -
              16),
      }),
      velocity: Object.freeze({
        x: fromLeft ? speed : -speed,
        y: (rng.nextFloat() < 0.5 ? -1 : 1) * (24 + wave * 1.5),
      }),
      repairCooldownSeconds: 0,
    });
  }
  return Object.freeze({
    id,
    kind,
    position: Object.freeze({
      x: fromLeft ? -8 : BUG_BARRAGE_RUN_RULES.logicalWidth + 8,
      y: 56 + rng.nextFloat() * 96,
    }),
    velocity: Object.freeze({ x: fromLeft ? speed * 0.72 : -speed * 0.72, y: 0 }),
    repairCooldownSeconds: 0,
  });
}

export function stepBugBarrageRoamer(
  roamer: BugBarrageRoamer,
  dtSeconds: number,
): BugBarrageRoamer | null {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
  let velocity = roamer.velocity;
  let y = roamer.position.y + velocity.y * dtSeconds;
  if (roamer.kind === "skimmer") {
    const top = BUG_BARRAGE_RUN_RULES.playerRegionTop + 6;
    const bottom = BUG_BARRAGE_RUN_RULES.playerRegionBottom - 6;
    if (y < top || y > bottom) {
      velocity = Object.freeze({ x: velocity.x, y: -velocity.y });
      y = Math.max(top, Math.min(bottom, y));
    }
  }
  const x = roamer.position.x + velocity.x * dtSeconds;
  if (x < -18 || x > BUG_BARRAGE_RUN_RULES.logicalWidth + 18) {
    return null;
  }
  return Object.freeze({
    ...roamer,
    position: Object.freeze({ x, y }),
    velocity,
    repairCooldownSeconds: Math.max(0, roamer.repairCooldownSeconds - dtSeconds),
  });
}
