import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  DEEP_DIGGER_DIFFICULTIES,
  DEEP_DIGGER_RUN_RULES,
  type DeepDiggerDifficultyId,
} from "./design.js";
import { DeepDiggerEffects } from "./effects.js";
import { DEEP_DIGGER_METADATA } from "./metadata.js";
import { DeepDiggerScoreCommitter } from "./score-submission.js";
import {
  DeepDiggerSimulation,
  type DeepDiggerEnemyState,
  type DeepDiggerRock,
} from "./simulation.js";
import type { GridCell, GridDirection } from "./terrain.js";

function resolveDifficulty(value: string): DeepDiggerDifficultyId {
  if (!Object.hasOwn(DEEP_DIGGER_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Deep Digger difficulty: ${value}`);
  }
  return value as DeepDiggerDifficultyId;
}

function cellCenter(cell: GridCell): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x:
      DEEP_DIGGER_RUN_RULES.fieldOriginX +
      cell.column * DEEP_DIGGER_RUN_RULES.tileSize +
      DEEP_DIGGER_RUN_RULES.tileSize / 2,
    y:
      DEEP_DIGGER_RUN_RULES.fieldOriginY +
      cell.row * DEEP_DIGGER_RUN_RULES.tileSize +
      DEEP_DIGGER_RUN_RULES.tileSize / 2,
  });
}

function chooseMoveDirection(services: GameServices): GridDirection | null {
  const left = services.input.isHeld(1, "left");
  const right = services.input.isHeld(1, "right");
  const up = services.input.isHeld(1, "up");
  const down = services.input.isHeld(1, "down");
  if (left !== right) {
    return left ? "left" : "right";
  }
  if (up !== down) {
    return up ? "up" : "down";
  }
  return null;
}

function renderEnemy(renderer: GameRenderer, enemy: DeepDiggerEnemyState): void {
  const center = cellCenter(enemy.cell);
  const pressure = enemy.pressureStage;
  const radius = 3.7 + pressure * 0.8;
  const bodyColor = enemy.mode === "phase" ? "#ab97ff" : "#6ee7a8";
  renderer.fillCircle(center.x, center.y, radius, bodyColor);
  renderer.fillCircle(center.x - 1.4, center.y - 0.8, 0.8, "#13232b");
  renderer.fillCircle(center.x + 1.4, center.y - 0.8, 0.8, "#13232b");
  renderer.drawLine(
    center.x - radius,
    center.y + 1.5,
    center.x - radius - 2.5,
    center.y + 3,
    bodyColor,
    1,
  );
  renderer.drawLine(
    center.x + radius,
    center.y + 1.5,
    center.x + radius + 2.5,
    center.y + 3,
    bodyColor,
    1,
  );
  if (enemy.mode === "phase") {
    renderer.strokeCircle(center.x, center.y, radius + 2, "#e0d8ff", 1);
  }
  for (let stage = 0; stage < pressure; stage += 1) {
    renderer.strokeCircle(center.x, center.y, radius + 2 + stage * 1.5, "#ffd56a", 1);
  }
}

function renderRock(renderer: GameRenderer, rock: DeepDiggerRock): void {
  const center = cellCenter(rock.cell);
  const shake =
    rock.state === "shaking" && Math.floor(rock.shakeRemainingSeconds * 30) % 2 === 0
      ? 1
      : 0;
  renderer.fillPolygon(
    [
      { x: center.x - 4 + shake, y: center.y + 1 },
      { x: center.x - 2 + shake, y: center.y - 4 },
      { x: center.x + 3 + shake, y: center.y - 3 },
      { x: center.x + 5 + shake, y: center.y + 2 },
      { x: center.x + 1 + shake, y: center.y + 5 },
      { x: center.x - 3 + shake, y: center.y + 4 },
    ],
    rock.state === "falling" ? "#f0c276" : "#a8784d",
  );
  renderer.drawLine(
    center.x - 1 + shake,
    center.y - 3,
    center.x + 2 + shake,
    center.y + 1,
    "#6b4933",
    1,
  );
}

function renderPlayer(
  renderer: GameRenderer,
  cell: GridCell,
  facing: GridDirection,
): void {
  const center = cellCenter(cell);
  renderer.fillCircle(center.x, center.y, 4.1, "#4bd6ed");
  renderer.fillRect(center.x - 3.5, center.y - 5.5, 7, 2.5, "#ffd35a");
  renderer.fillRect(center.x - 2.5, center.y + 1.8, 5, 2.6, "#216c86");
  const directionOffset =
    facing === "left"
      ? { x: -3, y: -0.5 }
      : facing === "right"
        ? { x: 3, y: -0.5 }
        : facing === "up"
          ? { x: 0, y: -3 }
          : { x: 0, y: 3 };
  renderer.fillCircle(
    center.x + directionOffset.x,
    center.y + directionOffset.y,
    1,
    "#10202b",
  );
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/dig.wav":
      return new URL("./audio/dig.wav", import.meta.url).href;
    case "audio/pump.wav":
      return new URL("./audio/pump.wav", import.meta.url).href;
    case "audio/defeat.wav":
      return new URL("./audio/defeat.wav", import.meta.url).href;
    case "audio/rock.wav":
      return new URL("./audio/rock.wav", import.meta.url).href;
    case "audio/hit.wav":
      return new URL("./audio/hit.wav", import.meta.url).href;
    case "audio/wave.wav":
      return new URL("./audio/wave.wav", import.meta.url).href;
    default:
      return null;
  }
}

export class DeepDiggerGameInstance implements GameInstance {
  private simulation: DeepDiggerSimulation | null = null;
  private effects: DeepDiggerEffects;
  private readonly scoreCommitter: DeepDiggerScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new DeepDiggerEffects(services.audio);
    this.scoreCommitter = new DeepDiggerScoreCommitter(services.scores, (error) => {
      services.logger.warn(`Deep Digger score persistence failed: ${String(error)}`);
    });
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Deep Digger supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new DeepDiggerEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new DeepDiggerSimulation({
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
      {
        move: chooseMoveDirection(this.services),
        attack: this.services.input.wasPressed(1, "action-1"),
      },
      dtSeconds,
    );
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    // CR2-001: submit under the same "default" mode every other game uses. Difficulty scoping
    // already happens one layer down, in PersistentScoreService (src/engine/scores/scores.ts),
    // which attaches the run's difficulty to every submission before it reaches the repository --
    // the launcher's own high-score query is hard-coded to mode "default" and reads difficulty
    // through that separate column, so a game-specific mode here was never actually read and just
    // made every Deep Digger score invisible in the launcher.
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#17101a");
    renderer.drawText("DEEP DIGGER", 8, 8, {
      color: "#66e1f2",
      font: "bold 11px monospace",
      baseline: "top",
    });

    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText(
        "COPPER LATTICE",
        renderer.logicalWidth / 2,
        renderer.logicalHeight / 2,
        {
          color: "#ffd56a",
          font: "bold 15px monospace",
          align: "center",
          baseline: "middle",
        },
      );
      return;
    }

    const tile = DEEP_DIGGER_RUN_RULES.tileSize;
    const originX = DEEP_DIGGER_RUN_RULES.fieldOriginX;
    const originY = DEEP_DIGGER_RUN_RULES.fieldOriginY;
    for (let row = 0; row < simulation.terrain.rows; row += 1) {
      const depthShade = row < 5 ? "#75472f" : row < 11 ? "#673b32" : "#58313a";
      for (let column = 0; column < simulation.terrain.columns; column += 1) {
        const x = originX + column * tile;
        const y = originY + row * tile;
        const cell = { column, row };
        if (simulation.terrain.isTunnel(cell)) {
          renderer.fillRect(x, y, tile, tile, "#231722");
          if ((column * 7 + row * 11) % 5 === 0) {
            renderer.fillRect(x + 1, y + 1, 1, 1, "#5b3b39");
          }
        } else {
          renderer.fillRect(x, y, tile, tile, depthShade);
          if ((column * 13 + row * 17) % 4 === 0) {
            renderer.fillRect(x + 2, y + 3, 2, 1, "#98603d");
          }
        }
      }
    }
    renderer.strokeRect(
      originX - 1,
      originY - 1,
      simulation.terrain.columns * tile + 2,
      simulation.terrain.rows * tile + 2,
      "#d49555",
      1,
    );

    for (const rock of simulation.rocks) {
      renderRock(renderer, rock);
    }
    for (const enemy of simulation.enemies) {
      renderEnemy(renderer, enemy);
    }

    const blink =
      simulation.invulnerabilitySeconds > 0 &&
      Math.floor(simulation.invulnerabilitySeconds * 10) % 2 === 0;
    if (!simulation.gameOver && !blink) {
      renderPlayer(renderer, simulation.player.cell, simulation.player.facing);
    }

    if (simulation.pumpVisible && simulation.pumpTarget !== null) {
      const from = cellCenter(simulation.player.cell);
      const to = cellCenter(simulation.pumpTarget);
      renderer.drawLine(from.x, from.y, to.x, to.y, "#ffe783", 1.5);
    }

    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 8, 27, {
      color: "#f8edd8",
      font: "bold 9px monospace",
      baseline: "top",
    });
    renderer.drawText(`LIVES ${simulation.lives}`, renderer.logicalWidth - 8, 8, {
      color: "#ff8b7d",
      font: "bold 9px monospace",
      align: "right",
      baseline: "top",
    });
    renderer.drawText(`DEPTH ${simulation.wave}`, renderer.logicalWidth - 8, 27, {
      color: "#92f2bf",
      font: "bold 9px monospace",
      align: "right",
      baseline: "top",
    });
    renderer.drawText(
      `STALKERS ${simulation.enemies.length}`,
      renderer.logicalWidth / 2,
      27,
      {
        color: "#cabdff",
        font: "bold 9px monospace",
        align: "center",
        baseline: "top",
      },
    );

    if (simulation.gameOver) {
      renderer.fillRect(75, 104, 170, 38, "#17101a");
      renderer.strokeRect(75, 104, 170, 38, "#ff8b7d", 1);
      renderer.drawText("SHIFT ENDED", renderer.logicalWidth / 2, 116, {
        color: "#ff8b7d",
        font: "bold 15px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 132, {
        color: "#f8edd8",
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
    if (this.runOptions !== null) {
      this.start(this.runOptions);
    }
  }

  public destroy(): void {
    this.effects.destroy();
    this.simulation = null;
    this.runOptions = null;
    this.paused = false;
  }
}

export const DEEP_DIGGER_MODULE: GameModule = Object.freeze({
  metadata: DEEP_DIGGER_METADATA,
  create: (services: GameServices) => new DeepDiggerGameInstance(services),
  resolveAssetUrl: assetUrl,
});
