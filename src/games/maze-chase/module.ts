import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  MAZE_CHASE_DIFFICULTIES,
  MAZE_CHASE_RUN_RULES,
  type MazeChaseDifficultyId,
} from "./design.js";
import { MazeChaseEffects } from "./effects.js";
import { MAZE_CHASE_METADATA } from "./metadata.js";
import {
  cellKey,
  type Direction,
  type EnemyId,
} from "./maze.js";
import { corridorPosition } from "./movement.js";
import { MazeChaseScoreCommitter } from "./score-submission.js";
import { MazeChaseSimulation } from "./simulation.js";

const ENEMY_COLORS: Readonly<Record<EnemyId, string>> = Object.freeze({
  amber: "#ffb14a",
  cyan: "#55e6ef",
  lime: "#8de969",
  violet: "#c48cff",
});

function resolveDifficulty(value: string): MazeChaseDifficultyId {
  if (!Object.hasOwn(MAZE_CHASE_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Maze Chase difficulty: ${value}`);
  }
  return value as MazeChaseDifficultyId;
}

function toScreen(position: { readonly x: number; readonly y: number }): {
  readonly x: number;
  readonly y: number;
} {
  return Object.freeze({
    x: MAZE_CHASE_RUN_RULES.mazeOriginX +
      (position.x + 0.5) * MAZE_CHASE_RUN_RULES.tileSize,
    y: MAZE_CHASE_RUN_RULES.mazeOriginY +
      (position.y + 0.5) * MAZE_CHASE_RUN_RULES.tileSize,
  });
}

function directionRotation(direction: Direction | null): number {
  switch (direction) {
    case "up":
      return -Math.PI / 2;
    case "down":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "right":
    case null:
      return 0;
  }
}

function desiredDirection(services: GameServices): Direction | null {
  const directions: readonly Direction[] = ["up", "left", "down", "right"];
  for (const direction of directions) {
    if (services.input.wasPressed(1, direction)) {
      return direction;
    }
  }
  for (const direction of directions) {
    if (services.input.isHeld(1, direction)) {
      return direction;
    }
  }
  return null;
}

function renderPlayer(
  renderer: GameRenderer,
  position: { readonly x: number; readonly y: number },
  direction: Direction | null,
): void {
  const screen = toScreen(position);
  renderer.save();
  renderer.translate(screen.x, screen.y);
  renderer.rotate(directionRotation(direction));
  renderer.fillCircle(0, 0, 4.2, "#78f4ff");
  renderer.fillPolygon(
    [
      { x: 1.5, y: -2.5 },
      { x: 6.2, y: 0 },
      { x: 1.5, y: 2.5 },
    ],
    "#fff2a8",
  );
  renderer.fillCircle(-1, 0, 1.5, "#12324a");
  renderer.restore();
}

function renderEnemy(
  renderer: GameRenderer,
  id: EnemyId,
  position: { readonly x: number; readonly y: number },
  vulnerable: boolean,
): void {
  const screen = toScreen(position);
  const color = vulnerable ? "#6688ff" : ENEMY_COLORS[id];
  renderer.save();
  renderer.translate(screen.x, screen.y);
  switch (id) {
    case "amber":
      renderer.fillPolygon(
        [{ x: 0, y: -5 }, { x: 5, y: 0 }, { x: 0, y: 5 }, { x: -5, y: 0 }],
        color,
      );
      break;
    case "cyan":
      renderer.fillRect(-4.5, -4.5, 9, 9, color);
      break;
    case "lime":
      renderer.fillPolygon(
        [{ x: 0, y: -5.5 }, { x: 5, y: 4 }, { x: -5, y: 4 }],
        color,
      );
      break;
    case "violet":
      renderer.fillPolygon(
        [
          { x: -4.5, y: -3.5 },
          { x: 0, y: -5.5 },
          { x: 4.5, y: -3.5 },
          { x: 4.5, y: 3.5 },
          { x: 0, y: 5.5 },
          { x: -4.5, y: 3.5 },
        ],
        color,
      );
      break;
  }
  renderer.fillCircle(-1.7, -0.8, 1.15, "#f7fbff");
  renderer.fillCircle(1.7, -0.8, 1.15, "#f7fbff");
  renderer.restore();
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/pellet.wav":
      return new URL("./audio/pellet.wav", import.meta.url).href;
    case "audio/power.wav":
      return new URL("./audio/power.wav", import.meta.url).href;
    case "audio/capture.wav":
      return new URL("./audio/capture.wav", import.meta.url).href;
    case "audio/hit.wav":
      return new URL("./audio/hit.wav", import.meta.url).href;
    case "audio/bonus.wav":
      return new URL("./audio/bonus.wav", import.meta.url).href;
    case "audio/level-clear.wav":
      return new URL("./audio/level-clear.wav", import.meta.url).href;
    default:
      return null;
  }
}

export class MazeChaseGameInstance implements GameInstance {
  private simulation: MazeChaseSimulation | null = null;
  private effects: MazeChaseEffects;
  private readonly scoreCommitter: MazeChaseScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new MazeChaseEffects(services.audio);
    this.scoreCommitter = new MazeChaseScoreCommitter(services.scores, (error) => {
      services.logger.warn(`Maze Chase score persistence failed: ${String(error)}`);
    });
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Maze Chase supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new MazeChaseEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new MazeChaseSimulation({
      rng: this.services.rng,
      difficulty,
    });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
  }

  public update(dtSeconds: number): void {
    const simulation = this.simulation;
    if (simulation === null || this.paused) {
      return;
    }
    const events = simulation.update(
      { desiredDirection: desiredDirection(this.services) },
      dtSeconds,
    );
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#060713");
    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText("MAZE CHASE", renderer.logicalWidth / 2, renderer.logicalHeight / 2, {
        color: "#78f4ff",
        font: "bold 18px monospace",
        align: "center",
        baseline: "middle",
      });
      return;
    }

    const maze = simulation.maze;
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const screen = toScreen({ x, y });
        const left = screen.x - MAZE_CHASE_RUN_RULES.tileSize / 2;
        const top = screen.y - MAZE_CHASE_RUN_RULES.tileSize / 2;
        if (maze.walls.has(cellKey({ x, y }))) {
          renderer.fillRect(
            left + 0.7,
            top + 0.7,
            MAZE_CHASE_RUN_RULES.tileSize - 1.4,
            MAZE_CHASE_RUN_RULES.tileSize - 1.4,
            "#392767",
          );
          renderer.strokeRect(
            left + 2,
            top + 2,
            MAZE_CHASE_RUN_RULES.tileSize - 4,
            MAZE_CHASE_RUN_RULES.tileSize - 4,
            "#7862bb",
            0.8,
          );
        }
      }
    }

    for (const key of simulation.remainingPellets) {
      const [xText, yText] = key.split(",");
      const x = Number(xText);
      const y = Number(yText);
      const screen = toScreen({ x, y });
      renderer.fillCircle(screen.x, screen.y, 1.15, "#d9e8ff");
    }
    for (const key of simulation.remainingPowerItems) {
      const [xText, yText] = key.split(",");
      const x = Number(xText);
      const y = Number(yText);
      const screen = toScreen({ x, y });
      renderer.strokeCircle(screen.x, screen.y, 3, "#8bf8ff", 1.5);
      renderer.fillCircle(screen.x, screen.y, 1.1, "#ffffff");
    }

    if (simulation.bonusVisible) {
      const bonus = toScreen(maze.bonusSpawn);
      renderer.fillPolygon(
        [
          { x: bonus.x, y: bonus.y - 4.5 },
          { x: bonus.x + 4.5, y: bonus.y },
          { x: bonus.x, y: bonus.y + 4.5 },
          { x: bonus.x - 4.5, y: bonus.y },
        ],
        "#ffd95e",
      );
      renderer.fillCircle(bonus.x, bonus.y, 1.5, "#ff7d65");
    }

    const protectedBlink =
      simulation.respawnGraceSeconds > 0 &&
      Math.floor(simulation.respawnGraceSeconds * 10) % 2 === 0;
    if (!simulation.gameOver && !protectedBlink) {
      renderPlayer(renderer, simulation.playerPosition, simulation.player.direction);
    }

    for (const enemy of simulation.enemies) {
      if (enemy.respawnSeconds > 0) {
        continue;
      }
      renderEnemy(
        renderer,
        enemy.id,
        corridorPosition(maze, enemy.mover),
        simulation.vulnerabilitySeconds > 0,
      );
    }

    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 8, 8, {
      color: "#e7f7ff",
      font: "bold 9px monospace",
      baseline: "top",
    });
    renderer.drawText(`LIVES ${simulation.lives}`, renderer.logicalWidth - 8, 8, {
      color: "#ffd95e",
      font: "bold 9px monospace",
      align: "right",
      baseline: "top",
    });
    renderer.drawText(`LEVEL ${simulation.level}`, renderer.logicalWidth / 2, 8, {
      color: "#a0f4be",
      font: "bold 9px monospace",
      align: "center",
      baseline: "top",
    });
    renderer.drawText(
      simulation.vulnerabilitySeconds > 0 ? "OVERRIDE" : simulation.phaseMode.toUpperCase(),
      renderer.logicalWidth / 2,
      renderer.logicalHeight - 8,
      {
        color: simulation.vulnerabilitySeconds > 0 ? "#8bf8ff" : "#9a91c4",
        font: "8px monospace",
        align: "center",
        baseline: "bottom",
      },
    );

    if (simulation.gameOver) {
      renderer.fillRect(84, 101, 152, 38, "#111326");
      renderer.strokeRect(84, 101, 152, 38, "#ff746c", 1);
      renderer.drawText("CIRCUIT CLOSED", renderer.logicalWidth / 2, 113, {
        color: "#ff8a80",
        font: "bold 14px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 128, {
        color: "#e7f7ff",
        font: "8px monospace",
        align: "center",
        baseline: "middle",
      });
    }
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public reset(): void {
    const options = this.runOptions;
    if (options !== null) {
      this.start(options);
    }
  }

  public destroy(): void {
    this.effects.destroy();
    this.simulation = null;
    this.runOptions = null;
    this.paused = false;
  }
}

export const MAZE_CHASE_MODULE: GameModule = Object.freeze({
  metadata: MAZE_CHASE_METADATA,
  create: (services: GameServices) => new MazeChaseGameInstance(services),
  resolveAssetUrl: assetUrl,
});
