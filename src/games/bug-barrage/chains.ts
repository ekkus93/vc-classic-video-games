import type { Vector2 } from "../../engine/index.js";
import { BUG_BARRAGE_RUN_RULES } from "./design.js";
import { obstacleAtPoint, type BugBarrageObstacle } from "./field.js";

export interface BugBarrageSegment {
  readonly id: number;
  readonly position: Vector2;
  readonly direction: -1 | 1;
  readonly verticalDirection: -1 | 1;
}

export interface BugBarrageChain {
  readonly id: number;
  readonly segments: readonly BugBarrageSegment[];
}

export function createBugBarrageChain(
  chainId: number,
  firstSegmentId: number,
  count: number,
): BugBarrageChain {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError("count must be a positive safe integer");
  }
  return Object.freeze({
    id: chainId,
    segments: Object.freeze(
      Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / 22);
        const column = index % 22;
        const direction = row % 2 === 0 ? 1 : -1;
        return Object.freeze({
          id: firstSegmentId + index,
          position: Object.freeze({
            x: direction === 1 ? 22 + column * 13 : 295 - column * 13,
            y: 22 + row * BUG_BARRAGE_RUN_RULES.rowStep,
          }),
          direction: direction as -1 | 1,
          verticalDirection: 1 as const,
        });
      }),
    ),
  });
}

export function stepBugBarrageChain(
  chain: BugBarrageChain,
  obstacles: readonly BugBarrageObstacle[],
  speed: number,
  dtSeconds: number,
): BugBarrageChain {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError("speed must be a non-negative finite number");
  }
  const maxSubstepDistance = 3;
  const distance = speed * dtSeconds;
  const steps = Math.max(1, Math.ceil(distance / maxSubstepDistance));
  const subDt = steps === 0 ? 0 : dtSeconds / steps;
  let segments = [...chain.segments];
  for (let step = 0; step < steps; step += 1) {
    segments = segments.map((segment) => stepSegment(segment, obstacles, speed, subDt));
  }
  return Object.freeze({ ...chain, segments: Object.freeze(segments) });
}

export function splitBugBarrageChain(
  chain: BugBarrageChain,
  hitSegmentId: number,
  firstNewChainId: number,
): readonly BugBarrageChain[] {
  const index = chain.segments.findIndex((segment) => segment.id === hitSegmentId);
  if (index < 0) {
    return Object.freeze([chain]);
  }
  const groups = [chain.segments.slice(0, index), chain.segments.slice(index + 1)].filter(
    (segments) => segments.length > 0,
  );
  return Object.freeze(
    groups.map((segments, groupIndex) =>
      Object.freeze({
        id: firstNewChainId + groupIndex,
        segments: Object.freeze([...segments]),
      }),
    ),
  );
}

function stepSegment(
  segment: BugBarrageSegment,
  obstacles: readonly BugBarrageObstacle[],
  speed: number,
  dtSeconds: number,
): BugBarrageSegment {
  const radius = BUG_BARRAGE_RUN_RULES.segmentRadius;
  const candidate = {
    x: segment.position.x + segment.direction * speed * dtSeconds,
    y: segment.position.y,
  };
  const hitsWall =
    candidate.x < radius + 2 ||
    candidate.x > BUG_BARRAGE_RUN_RULES.logicalWidth - radius - 2;
  const hitsObstacle = obstacleAtPoint(obstacles, candidate, radius - 1) !== null;
  if (!hitsWall && !hitsObstacle) {
    return Object.freeze({ ...segment, position: Object.freeze(candidate) });
  }

  let verticalDirection = segment.verticalDirection;
  let nextY = segment.position.y + verticalDirection * BUG_BARRAGE_RUN_RULES.rowStep;
  const lowerLimit = BUG_BARRAGE_RUN_RULES.playerRegionBottom - radius;
  if (nextY > lowerLimit) {
    verticalDirection = -1;
    nextY = segment.position.y - BUG_BARRAGE_RUN_RULES.rowStep;
  } else if (nextY < 22) {
    verticalDirection = 1;
    nextY = segment.position.y + BUG_BARRAGE_RUN_RULES.rowStep;
  }
  return Object.freeze({
    ...segment,
    position: Object.freeze({ x: segment.position.x, y: nextY }),
    direction: (segment.direction === 1 ? -1 : 1) as -1 | 1,
    verticalDirection,
  });
}
