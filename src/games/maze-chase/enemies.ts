import type { RandomService } from "../../engine/index.js";
import { MAZE_CHASE_PHASES, type MazeChasePhaseMode } from "./design.js";
import {
  MAZE_CHASE_DIRECTIONS,
  directionVector,
  legalDirections,
  nearestWalkableCell,
  neighborCell,
  oppositeDirection,
  shortestPathDistance,
  type Direction,
  type EnemyId,
  type MazeCell,
  type MazeDefinition,
} from "./maze.js";
import type { CorridorMover } from "./movement.js";

export interface EnemyState {
  readonly id: EnemyId;
  readonly mover: CorridorMover;
  readonly respawnSeconds: number;
}

export interface PlayerTargetState {
  readonly cell: MazeCell;
  readonly direction: Direction | null;
}

export class MazeChasePhaseScheduler {
  private phaseIndexValue = 0;
  private elapsedSecondsValue = 0;

  public get mode(): MazeChasePhaseMode {
    return MAZE_CHASE_PHASES[this.phaseIndexValue]?.mode ?? "pursuit";
  }

  public get phaseIndex(): number {
    return this.phaseIndexValue;
  }

  public reset(): void {
    this.phaseIndexValue = 0;
    this.elapsedSecondsValue = 0;
  }

  public update(dtSeconds: number): boolean {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    let changed = false;
    this.elapsedSecondsValue += dtSeconds;
    while (this.phaseIndexValue < MAZE_CHASE_PHASES.length - 1) {
      const phase = MAZE_CHASE_PHASES[this.phaseIndexValue];
      if (phase === undefined || this.elapsedSecondsValue < phase.seconds) {
        break;
      }
      this.elapsedSecondsValue -= phase.seconds;
      this.phaseIndexValue += 1;
      changed = true;
    }
    return changed;
  }
}

const PATROL_TARGETS: Readonly<Record<EnemyId, MazeCell>> = Object.freeze({
  amber: Object.freeze({ x: 1, y: 1 }),
  cyan: Object.freeze({ x: 19, y: 1 }),
  lime: Object.freeze({ x: 1, y: 15 }),
  violet: Object.freeze({ x: 19, y: 15 }),
});

function projectedCell(player: PlayerTargetState, distance: number): MazeCell {
  if (player.direction === null) {
    return player.cell;
  }
  const vector = directionVector(player.direction);
  return {
    x: player.cell.x + vector.x * distance,
    y: player.cell.y + vector.y * distance,
  };
}

export function enemyTargetCell(
  maze: MazeDefinition,
  id: EnemyId,
  mode: MazeChasePhaseMode,
  player: PlayerTargetState,
  enemyCell: MazeCell,
): MazeCell {
  if (mode === "patrol") {
    return nearestWalkableCell(maze, PATROL_TARGETS[id]);
  }

  switch (id) {
    case "amber":
      return player.cell;
    case "cyan":
      return nearestWalkableCell(maze, projectedCell(player, 4));
    case "lime": {
      const perpendicular =
        player.direction === "up" || player.direction === "down"
          ? { x: player.cell.x + (player.cell.x < maze.width / 2 ? 4 : -4), y: player.cell.y }
          : { x: player.cell.x, y: player.cell.y + (player.cell.y < maze.height / 2 ? 4 : -4) };
      return nearestWalkableCell(maze, perpendicular);
    }
    case "violet": {
      const distance =
        Math.abs(enemyCell.x - player.cell.x) + Math.abs(enemyCell.y - player.cell.y);
      return distance <= 5
        ? nearestWalkableCell(maze, PATROL_TARGETS.violet)
        : nearestWalkableCell(maze, projectedCell(player, 2));
    }
  }
}

function candidateDirections(
  maze: MazeDefinition,
  cell: MazeCell,
  current: Direction | null,
): readonly Direction[] {
  const legal = legalDirections(maze, cell);
  if (current === null || legal.length <= 1) {
    return legal;
  }
  const reverse = oppositeDirection(current);
  const withoutReverse = legal.filter((direction) => direction !== reverse);
  return withoutReverse.length > 0 ? withoutReverse : legal;
}

export function chooseTargetDirection(
  maze: MazeDefinition,
  cell: MazeCell,
  current: Direction | null,
  target: MazeCell,
): Direction | null {
  const candidates = candidateDirections(maze, cell, current);
  let best: Direction | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const direction of MAZE_CHASE_DIRECTIONS) {
    if (!candidates.includes(direction)) {
      continue;
    }
    const neighbor = neighborCell(maze, cell, direction);
    if (neighbor === null) {
      continue;
    }
    const distance = shortestPathDistance(maze, neighbor, target);
    if (distance < bestDistance) {
      best = direction;
      bestDistance = distance;
    }
  }
  return best;
}

export function chooseFrightenedDirection(
  maze: MazeDefinition,
  cell: MazeCell,
  current: Direction | null,
  rng: RandomService,
): Direction | null {
  const candidates = candidateDirections(maze, cell, current);
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.min(
    candidates.length - 1,
    Math.floor(rng.nextFloat() * candidates.length),
  );
  return candidates[index] ?? null;
}
