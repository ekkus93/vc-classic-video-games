export interface GridCell {
  readonly column: number;
  readonly row: number;
}

export type GridDirection = "up" | "down" | "left" | "right";

export const GRID_DIRECTIONS: readonly GridDirection[] = Object.freeze([
  "up",
  "right",
  "down",
  "left",
]);

export function sameCell(a: GridCell, b: GridCell): boolean {
  return a.column === b.column && a.row === b.row;
}

export function stepCell(cell: GridCell, direction: GridDirection): GridCell {
  switch (direction) {
    case "up":
      return Object.freeze({ column: cell.column, row: cell.row - 1 });
    case "down":
      return Object.freeze({ column: cell.column, row: cell.row + 1 });
    case "left":
      return Object.freeze({ column: cell.column - 1, row: cell.row });
    case "right":
      return Object.freeze({ column: cell.column + 1, row: cell.row });
  }
}

function cellKey(cell: GridCell): string {
  return `${cell.column},${cell.row}`;
}

export class DeepDiggerTerrain {
  private readonly tunnelCells: boolean[];

  public constructor(
    public readonly columns: number,
    public readonly rows: number,
    initialTunnels: readonly GridCell[] = [],
  ) {
    if (!Number.isSafeInteger(columns) || columns <= 0) {
      throw new RangeError("columns must be a positive safe integer");
    }
    if (!Number.isSafeInteger(rows) || rows <= 0) {
      throw new RangeError("rows must be a positive safe integer");
    }
    this.tunnelCells = Array.from({ length: columns * rows }, () => false);
    for (const cell of initialTunnels) {
      if (!this.inBounds(cell)) {
        throw new RangeError(`initial tunnel is outside the grid: ${cellKey(cell)}`);
      }
      this.tunnelCells[this.index(cell)] = true;
    }
  }

  public clone(): DeepDiggerTerrain {
    const tunnels: GridCell[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const cell = { column, row };
        if (this.isTunnel(cell)) {
          tunnels.push(cell);
        }
      }
    }
    return new DeepDiggerTerrain(this.columns, this.rows, tunnels);
  }

  public inBounds(cell: GridCell): boolean {
    return (
      Number.isSafeInteger(cell.column) &&
      Number.isSafeInteger(cell.row) &&
      cell.column >= 0 &&
      cell.column < this.columns &&
      cell.row >= 0 &&
      cell.row < this.rows
    );
  }

  public isTunnel(cell: GridCell): boolean {
    if (!this.inBounds(cell)) {
      return false;
    }
    return this.tunnelCells[this.index(cell)] === true;
  }

  public carve(cell: GridCell): boolean {
    if (!this.inBounds(cell)) {
      return false;
    }
    const index = this.index(cell);
    if (this.tunnelCells[index] === true) {
      return false;
    }
    this.tunnelCells[index] = true;
    return true;
  }

  public tunnelNeighbors(cell: GridCell): readonly GridCell[] {
    const neighbors: GridCell[] = [];
    for (const direction of GRID_DIRECTIONS) {
      const candidate = stepCell(cell, direction);
      if (this.isTunnel(candidate)) {
        neighbors.push(candidate);
      }
    }
    return Object.freeze(neighbors);
  }

  public findTunnelPath(start: GridCell, goal: GridCell): readonly GridCell[] {
    if (!this.isTunnel(start) || !this.isTunnel(goal)) {
      return Object.freeze([]);
    }
    if (sameCell(start, goal)) {
      return Object.freeze([Object.freeze({ ...start })]);
    }

    const queue: GridCell[] = [start];
    let readIndex = 0;
    const visited = new Set<string>([cellKey(start)]);
    const previous = new Map<string, GridCell>();

    while (readIndex < queue.length) {
      const current = queue[readIndex];
      readIndex += 1;
      if (current === undefined) {
        continue;
      }
      for (const neighbor of this.tunnelNeighbors(current)) {
        const key = cellKey(neighbor);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        previous.set(key, current);
        if (sameCell(neighbor, goal)) {
          return this.reconstructPath(start, neighbor, previous);
        }
        queue.push(neighbor);
      }
    }
    return Object.freeze([]);
  }

  public countTunnels(): number {
    let count = 0;
    for (const value of this.tunnelCells) {
      if (value) {
        count += 1;
      }
    }
    return count;
  }

  private index(cell: GridCell): number {
    return cell.row * this.columns + cell.column;
  }

  private reconstructPath(
    start: GridCell,
    goal: GridCell,
    previous: ReadonlyMap<string, GridCell>,
  ): readonly GridCell[] {
    const reversed: GridCell[] = [goal];
    let current = goal;
    while (!sameCell(current, start)) {
      const parent = previous.get(cellKey(current));
      if (parent === undefined) {
        return Object.freeze([]);
      }
      reversed.push(parent);
      current = parent;
    }
    return Object.freeze(
      reversed.reverse().map((cell) => Object.freeze({ ...cell })),
    );
  }
}
