import {
  neighborCell,
  oppositeDirection,
  type Direction,
  type MazeCell,
  type MazeDefinition,
} from "./maze.js";

export interface CorridorMover {
  readonly cell: MazeCell;
  readonly direction: Direction | null;
  readonly progress: number;
}

export interface CorridorPosition {
  readonly x: number;
  readonly y: number;
}

export function createCorridorMover(
  cell: MazeCell,
  direction: Direction | null = null,
): CorridorMover {
  return Object.freeze({ cell: Object.freeze({ ...cell }), direction, progress: 0 });
}

function reverseMover(
  maze: MazeDefinition,
  mover: CorridorMover,
): CorridorMover {
  if (mover.direction === null || mover.progress <= 0) {
    return mover;
  }
  const next = neighborCell(maze, mover.cell, mover.direction);
  if (next === null) {
    return mover;
  }
  return Object.freeze({
    cell: next,
    direction: oppositeDirection(mover.direction),
    progress: 1 - mover.progress,
  });
}

export function advanceCorridorMover(
  maze: MazeDefinition,
  mover: CorridorMover,
  desiredDirection: Direction | null,
  distanceTiles: number,
  chooseDirection?: (cell: MazeCell, current: Direction | null) => Direction | null,
): CorridorMover {
  if (!Number.isFinite(distanceTiles) || distanceTiles < 0) {
    throw new RangeError("distanceTiles must be a non-negative finite number");
  }

  let state = mover;
  let remaining = distanceTiles;

  if (
    desiredDirection !== null &&
    state.direction !== null &&
    desiredDirection === oppositeDirection(state.direction) &&
    state.progress > 0
  ) {
    state = reverseMover(maze, state);
  }

  let safety = 0;
  while (remaining > 1e-9 && safety < 64) {
    safety += 1;
    let direction = state.direction;
    if (state.progress <= 1e-9) {
      if (desiredDirection !== null && neighborCell(maze, state.cell, desiredDirection) !== null) {
        direction = desiredDirection;
      } else if (chooseDirection !== undefined) {
        const chosen = chooseDirection(state.cell, direction);
        if (chosen !== null && neighborCell(maze, state.cell, chosen) !== null) {
          direction = chosen;
        }
      }
      if (direction === null || neighborCell(maze, state.cell, direction) === null) {
        state = Object.freeze({ cell: state.cell, direction: null, progress: 0 });
        break;
      }
      state = Object.freeze({ cell: state.cell, direction, progress: 0 });
    }

    const available = 1 - state.progress;
    const step = Math.min(remaining, available);
    const nextProgress = state.progress + step;
    remaining -= step;

    if (nextProgress >= 1 - 1e-9) {
      const nextCell =
        state.direction === null ? null : neighborCell(maze, state.cell, state.direction);
      if (nextCell === null) {
        state = Object.freeze({ cell: state.cell, direction: null, progress: 0 });
        break;
      }
      state = Object.freeze({ cell: nextCell, direction: state.direction, progress: 0 });
    } else {
      state = Object.freeze({ ...state, progress: nextProgress });
    }
  }

  return state;
}

export function corridorPosition(
  maze: MazeDefinition,
  mover: CorridorMover,
): CorridorPosition {
  if (mover.direction === null || mover.progress === 0) {
    return Object.freeze({ x: mover.cell.x, y: mover.cell.y });
  }
  const next = neighborCell(maze, mover.cell, mover.direction);
  if (next === null) {
    return Object.freeze({ x: mover.cell.x, y: mover.cell.y });
  }
  let targetX = next.x;
  if (mover.direction === "left" && mover.cell.x === 0 && next.x === maze.width - 1) {
    targetX = -1;
  } else if (
    mover.direction === "right" &&
    mover.cell.x === maze.width - 1 &&
    next.x === 0
  ) {
    targetX = maze.width;
  }
  let x = mover.cell.x + (targetX - mover.cell.x) * mover.progress;
  if (x < -0.5) {
    x += maze.width;
  } else if (x > maze.width - 0.5) {
    x -= maze.width;
  }
  return Object.freeze({
    x,
    y: mover.cell.y + (next.y - mover.cell.y) * mover.progress,
  });
}
