export type Direction = "up" | "down" | "left" | "right";
export type EnemyId = "amber" | "cyan" | "lime" | "violet";

export interface MazeCell {
  readonly x: number;
  readonly y: number;
}

export interface MazeDefinition {
  readonly width: number;
  readonly height: number;
  readonly walls: ReadonlySet<string>;
  readonly pellets: ReadonlySet<string>;
  readonly powerItems: ReadonlySet<string>;
  readonly playerStart: MazeCell;
  readonly enemyStarts: Readonly<Record<EnemyId, MazeCell>>;
  readonly bonusSpawn: MazeCell;
  readonly tunnelRows: ReadonlySet<number>;
  readonly sourceRows: readonly string[];
}

export const MAZE_CHASE_DIRECTIONS: readonly Direction[] = Object.freeze([
  "up",
  "left",
  "down",
  "right",
]);

export const MAZE_CHASE_ORIGINAL_LAYOUT = Object.freeze([
  "#####################",
  "#o....#.......#....o#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "###.#.###.#.###.#.###",
  "#...#.....#.....#...#",
  "#.#.#####.#.#####.#.#",
  "#.#.....A..X.B....#.#",
  ".....###.....###.....",
  "#.#.....C.P.D.....#.#",
  "#.#.#####.#.#####.#.#",
  "#...#.....#.....#...#",
  "###.#.###.#.###.#.###",
  "#.....#...#...#.....#",
  "#.###.#.#####.#.###.#",
  "#o....#.......#....o#",
  "#####################",
]);

const ENEMY_SYMBOLS: Readonly<Record<string, EnemyId>> = Object.freeze({
  A: "amber",
  B: "cyan",
  C: "lime",
  D: "violet",
});

export function cellKey(cell: MazeCell): string {
  return `${cell.x},${cell.y}`;
}

export function sameCell(a: MazeCell, b: MazeCell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function oppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

export function directionVector(direction: Direction): MazeCell {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function requireSingleCell(
  found: readonly MazeCell[],
  name: string,
): MazeCell {
  if (found.length !== 1) {
    throw new Error(`Maze must contain exactly one ${name}; found ${found.length}`);
  }
  const cell = found[0];
  if (cell === undefined) {
    throw new Error(`Maze is missing ${name}`);
  }
  return Object.freeze({ ...cell });
}

function freezeEnemyStarts(
  starts: Readonly<Record<EnemyId, readonly MazeCell[]>>,
): Readonly<Record<EnemyId, MazeCell>> {
  return Object.freeze({
    amber: requireSingleCell(starts.amber, "amber enemy start (A)"),
    cyan: requireSingleCell(starts.cyan, "cyan enemy start (B)"),
    lime: requireSingleCell(starts.lime, "lime enemy start (C)"),
    violet: requireSingleCell(starts.violet, "violet enemy start (D)"),
  });
}

export function parseMaze(rows: readonly string[]): MazeDefinition {
  if (rows.length < 5) {
    throw new Error("Maze must be at least five rows tall");
  }
  const width = rows[0]?.length ?? 0;
  if (width < 5 || rows.some((row) => row.length !== width)) {
    throw new Error("Maze rows must have one consistent width of at least five cells");
  }

  const walls = new Set<string>();
  const pellets = new Set<string>();
  const powerItems = new Set<string>();
  const playerStarts: MazeCell[] = [];
  const bonusSpawns: MazeCell[] = [];
  const enemyStarts: Record<EnemyId, MazeCell[]> = {
    amber: [],
    cyan: [],
    lime: [],
    violet: [],
  };
  const tunnelRows = new Set<number>();

  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const symbol = row[x];
      const cell = { x, y };
      switch (symbol) {
        case "#":
          walls.add(cellKey(cell));
          break;
        case ".":
          pellets.add(cellKey(cell));
          break;
        case "o":
          powerItems.add(cellKey(cell));
          break;
        case "P":
          playerStarts.push(cell);
          break;
        case "X":
          bonusSpawns.push(cell);
          break;
        case " ":
          break;
        default: {
          const enemy = symbol === undefined ? undefined : ENEMY_SYMBOLS[symbol];
          if (enemy === undefined) {
            throw new Error(`Unsupported maze symbol ${String(symbol)} at ${x},${y}`);
          }
          enemyStarts[enemy].push(cell);
        }
      }
    }
    if (row[0] !== "#" && row[width - 1] !== "#") {
      tunnelRows.add(y);
    } else if ((row[0] === "#") !== (row[width - 1] === "#")) {
      throw new Error(`Tunnel row ${y} must be open at both horizontal edges or neither`);
    }
  });

  const maze: MazeDefinition = Object.freeze({
    width,
    height: rows.length,
    walls: Object.freeze(walls),
    pellets: Object.freeze(pellets),
    powerItems: Object.freeze(powerItems),
    playerStart: requireSingleCell(playerStarts, "player start (P)"),
    enemyStarts: freezeEnemyStarts(enemyStarts),
    bonusSpawn: requireSingleCell(bonusSpawns, "bonus spawn (X)"),
    tunnelRows: Object.freeze(tunnelRows),
    sourceRows: Object.freeze([...rows]),
  });

  validateMazeConnectivity(maze);
  return maze;
}

export function isWalkable(maze: MazeDefinition, cell: MazeCell): boolean {
  if (cell.y < 0 || cell.y >= maze.height) {
    return false;
  }
  if (cell.x < 0 || cell.x >= maze.width) {
    return maze.tunnelRows.has(cell.y);
  }
  return !maze.walls.has(cellKey(cell));
}

export function neighborCell(
  maze: MazeDefinition,
  cell: MazeCell,
  direction: Direction,
): MazeCell | null {
  const vector = directionVector(direction);
  let x = cell.x + vector.x;
  const y = cell.y + vector.y;
  if (!isWalkable(maze, { x, y })) {
    return null;
  }
  if (x < 0) {
    x = maze.width - 1;
  } else if (x >= maze.width) {
    x = 0;
  }
  return Object.freeze({ x, y });
}

export function legalDirections(
  maze: MazeDefinition,
  cell: MazeCell,
): readonly Direction[] {
  return Object.freeze(
    MAZE_CHASE_DIRECTIONS.filter(
      (direction) => neighborCell(maze, cell, direction) !== null,
    ),
  );
}

export function wrappedCellDistanceSquared(
  maze: MazeDefinition,
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  const rawX = Math.abs(a.x - b.x);
  const dx = Math.min(rawX, maze.width - rawX);
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function nearestWalkableCell(
  maze: MazeDefinition,
  target: MazeCell,
): MazeCell {
  const clamped = {
    x: Math.max(0, Math.min(maze.width - 1, target.x)),
    y: Math.max(0, Math.min(maze.height - 1, target.y)),
  };
  if (isWalkable(maze, clamped)) {
    return Object.freeze(clamped);
  }
  const visited = new Set<string>([cellKey(clamped)]);
  const queue: MazeCell[] = [clamped];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const direction of MAZE_CHASE_DIRECTIONS) {
      const vector = directionVector(direction);
      const next = { x: current.x + vector.x, y: current.y + vector.y };
      if (
        next.x < 0 ||
        next.x >= maze.width ||
        next.y < 0 ||
        next.y >= maze.height
      ) {
        continue;
      }
      const key = cellKey(next);
      if (visited.has(key)) {
        continue;
      }
      if (isWalkable(maze, next)) {
        return Object.freeze(next);
      }
      visited.add(key);
      queue.push(next);
    }
  }
  return maze.playerStart;
}

export function shortestPathDistance(
  maze: MazeDefinition,
  start: MazeCell,
  target: MazeCell,
): number {
  if (sameCell(start, target)) {
    return 0;
  }
  const visited = new Set<string>([cellKey(start)]);
  const queue: Array<{ readonly cell: MazeCell; readonly distance: number }> = [
    { cell: start, distance: 0 },
  ];
  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry === undefined) {
      break;
    }
    for (const direction of MAZE_CHASE_DIRECTIONS) {
      const next = neighborCell(maze, entry.cell, direction);
      if (next === null) {
        continue;
      }
      const key = cellKey(next);
      if (visited.has(key)) {
        continue;
      }
      if (sameCell(next, target)) {
        return entry.distance + 1;
      }
      visited.add(key);
      queue.push({ cell: next, distance: entry.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function validateMazeConnectivity(maze: MazeDefinition): void {
  const reachable = new Set<string>();
  const queue: MazeCell[] = [maze.playerStart];
  reachable.add(cellKey(maze.playerStart));
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const direction of MAZE_CHASE_DIRECTIONS) {
      const next = neighborCell(maze, current, direction);
      if (next === null) {
        continue;
      }
      const key = cellKey(next);
      if (!reachable.has(key)) {
        reachable.add(key);
        queue.push(next);
      }
    }
  }

  const required = [
    ...maze.pellets,
    ...maze.powerItems,
    cellKey(maze.bonusSpawn),
    ...Object.values(maze.enemyStarts).map(cellKey),
  ];
  const unreachable = required.filter((key) => !reachable.has(key));
  if (unreachable.length > 0) {
    throw new Error(`Maze contains unreachable required cells: ${unreachable.join(", ")}`);
  }
}

export const MAZE_CHASE_MAZE = parseMaze(MAZE_CHASE_ORIGINAL_LAYOUT);
