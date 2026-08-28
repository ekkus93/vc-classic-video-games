import type { RandomService, Vector2 } from "../../engine/index.js";
import {
  BUG_BARRAGE_LIMITS,
  BUG_BARRAGE_RUN_RULES,
} from "./design.js";

export interface BugBarrageObstacle {
  readonly id: number;
  readonly position: Vector2;
  readonly health: number;
}

const FIELD_COLUMNS = Object.freeze(
  Array.from({ length: 14 }, (_, index) => 20 + index * 20),
);
const FIELD_ROWS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => 34 + index * 13),
);

export function createBugBarrageField(
  rng: RandomService,
  count: number,
  firstId = 1,
): readonly BugBarrageObstacle[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative safe integer");
  }
  const capped = Math.min(count, BUG_BARRAGE_LIMITS.maxObstacles);
  const cells = FIELD_ROWS.flatMap((y) => FIELD_COLUMNS.map((x) => ({ x, y })));
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng.nextFloat() * (index + 1));
    const value = cells[index];
    cells[index] = cells[swapIndex]!;
    cells[swapIndex] = value!;
  }
  return Object.freeze(
    cells.slice(0, capped).map((position, index) =>
      Object.freeze({
        id: firstId + index,
        position: Object.freeze({ ...position }),
        health: BUG_BARRAGE_RUN_RULES.maxObstacleHealth,
      }),
    ),
  );
}

export function damageBugBarrageObstacle(
  obstacles: readonly BugBarrageObstacle[],
  id: number,
): {
  readonly obstacles: readonly BugBarrageObstacle[];
  readonly destroyed: boolean;
} {
  let destroyed = false;
  const next: BugBarrageObstacle[] = [];
  for (const obstacle of obstacles) {
    if (obstacle.id !== id) {
      next.push(obstacle);
      continue;
    }
    if (obstacle.health <= 1) {
      destroyed = true;
      continue;
    }
    next.push(Object.freeze({ ...obstacle, health: obstacle.health - 1 }));
  }
  return Object.freeze({ obstacles: Object.freeze(next), destroyed });
}

export function repairBugBarrageObstacle(
  obstacles: readonly BugBarrageObstacle[],
  id: number,
): readonly BugBarrageObstacle[] {
  return Object.freeze(
    obstacles.map((obstacle) =>
      obstacle.id === id && obstacle.health < BUG_BARRAGE_RUN_RULES.maxObstacleHealth
        ? Object.freeze({ ...obstacle, health: obstacle.health + 1 })
        : obstacle,
    ),
  );
}

export function addBugBarrageObstacle(
  obstacles: readonly BugBarrageObstacle[],
  obstacle: BugBarrageObstacle,
): readonly BugBarrageObstacle[] {
  if (obstacles.length >= BUG_BARRAGE_LIMITS.maxObstacles) {
    return obstacles;
  }
  const tooClose = obstacles.some(
    (existing) => distanceSquared(existing.position, obstacle.position) < 100,
  );
  return tooClose ? obstacles : Object.freeze([...obstacles, Object.freeze(obstacle)]);
}

export function nearestDamagedObstacle(
  obstacles: readonly BugBarrageObstacle[],
  position: Vector2,
  radius: number,
): BugBarrageObstacle | null {
  const radiusSquared = radius * radius;
  let nearest: BugBarrageObstacle | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const obstacle of obstacles) {
    if (obstacle.health >= BUG_BARRAGE_RUN_RULES.maxObstacleHealth) {
      continue;
    }
    const distance = distanceSquared(obstacle.position, position);
    if (distance <= radiusSquared && distance < nearestDistance) {
      nearest = obstacle;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function obstacleAtPoint(
  obstacles: readonly BugBarrageObstacle[],
  point: Vector2,
  extraRadius = 0,
): BugBarrageObstacle | null {
  const radius = BUG_BARRAGE_RUN_RULES.obstacleRadius + extraRadius;
  const radiusSquared = radius * radius;
  return (
    obstacles.find(
      (obstacle) => distanceSquared(obstacle.position, point) <= radiusSquared,
    ) ?? null
  );
}

function distanceSquared(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
