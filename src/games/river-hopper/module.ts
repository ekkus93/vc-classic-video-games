import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  RIVER_HOPPER_DIFFICULTIES,
  RIVER_HOPPER_GOAL_COLUMNS,
  RIVER_HOPPER_RUN_RULES,
  riverHopperGoalCenter,
  riverHopperRowCenter,
  type RiverHopperDifficultyId,
  type RiverHopperDirection,
} from "./design.js";
import {
  RIVER_HOPPER_AUDIO_IDS,
  RiverHopperEffects,
} from "./effects.js";
import { RIVER_HOPPER_METADATA } from "./metadata.js";
import { riverHopperLaneSegments } from "./moving-lane.js";
import { RiverHopperScoreCommitter } from "./score-submission.js";
import { RiverHopperSimulation } from "./simulation.js";

const ROAD_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  coral: "#f27b68",
  cyan: "#54c8d8",
  lime: "#a8c957",
  violet: "#9d7bd8",
  gold: "#e6b94e",
});

const RIVER_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  copper: "#a56d45",
  moss: "#708f5d",
  slate: "#71879b",
  amber: "#c58b42",
});

const DIRECTIONS: readonly RiverHopperDirection[] = Object.freeze([
  "up",
  "down",
  "left",
  "right",
]);

function resolveDifficulty(value: string): RiverHopperDifficultyId {
  if (!Object.hasOwn(RIVER_HOPPER_DIFFICULTIES, value)) {
    throw new Error(`Unsupported River Hopper difficulty: ${value}`);
  }
  return value as RiverHopperDifficultyId;
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/current.wav":
      return new URL("./audio/current.wav", import.meta.url).href;
    case "audio/hop.wav":
      return new URL("./audio/hop.wav", import.meta.url).href;
    case "audio/impact.wav":
      return new URL("./audio/impact.wav", import.meta.url).href;
    case "audio/splash.wav":
      return new URL("./audio/splash.wav", import.meta.url).href;
    case "audio/goal.wav":
      return new URL("./audio/goal.wav", import.meta.url).href;
    case "audio/round.wav":
      return new URL("./audio/round.wav", import.meta.url).href;
    default:
      return null;
  }
}

function renderPlayfield(renderer: GameRenderer): void {
  renderer.fillRect(0, RIVER_HOPPER_RUN_RULES.playTop, 320, 16, "#315a42");
  for (let row = 1; row <= 4; row += 1) {
    renderer.fillRect(0, RIVER_HOPPER_RUN_RULES.playTop + row * 16, 320, 16, row % 2 === 0 ? "#153f58" : "#174861");
  }
  renderer.fillRect(0, RIVER_HOPPER_RUN_RULES.playTop + 5 * 16, 320, 16, "#315a42");
  for (let row = 6; row <= 10; row += 1) {
    const y = RIVER_HOPPER_RUN_RULES.playTop + row * 16;
    renderer.fillRect(0, y, 320, 16, row % 2 === 0 ? "#2a2d35" : "#252932");
    for (let x = 8; x < 320; x += 32) {
      renderer.fillRect(x, y + 7.5, 12, 1, "#5a606c");
    }
  }
  renderer.fillRect(0, RIVER_HOPPER_RUN_RULES.playTop + 11 * 16, 320, 16, "#315a42");
}

function renderPlayer(renderer: GameRenderer, x: number, y: number, moving: boolean): void {
  renderer.save();
  renderer.translate(x, y);
  const body = moving ? "#8ff0d0" : "#67d8bc";
  renderer.fillPolygon(
    [
      { x: 0, y: -6 },
      { x: 8, y: -1 },
      { x: 6, y: 5 },
      { x: 0, y: 3 },
      { x: -6, y: 5 },
      { x: -8, y: -1 },
    ],
    body,
  );
  renderer.fillCircle(0, -1, 2.2, "#173a3d");
  renderer.drawLine(-7, 3, -10, 6, "#d8fff4", 1);
  renderer.drawLine(7, 3, 10, 6, "#d8fff4", 1);
  renderer.restore();
}

export class RiverHopperGameInstance implements GameInstance {
  private simulation: RiverHopperSimulation | null = null;
  private effects: RiverHopperEffects;
  private scoreCommitter: RiverHopperScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;
  private readonly consumedPresses = new Set<RiverHopperDirection>();

  public constructor(private readonly services: GameServices) {
    this.effects = new RiverHopperEffects(services.audio);
    this.scoreCommitter = new RiverHopperScoreCommitter(
      services.scores,
      () => services.logger.warn("River Hopper score persistence failed"),
    );
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("River Hopper supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new RiverHopperEffects(this.services.audio);
    this.effects.startCurrent();
    this.scoreCommitter.reset();
    this.simulation = new RiverHopperSimulation({ difficulty });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
    this.consumedPresses.clear();
  }

  public update(dtSeconds: number): void {
    const simulation = this.simulation;
    if (simulation === null || this.paused) {
      return;
    }
    const direction = this.readDirectionPress();
    const events = simulation.update(direction, dtSeconds);
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#10151d");
    renderer.fillRect(0, 0, renderer.logicalWidth, 28, "#111722");
    renderPlayfield(renderer);

    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText("RIVER HOPPER", renderer.logicalWidth / 2, renderer.logicalHeight / 2, {
        color: "#8ff0d0",
        font: "bold 18px monospace",
        align: "center",
        baseline: "middle",
      });
      return;
    }

    for (let slot = 0; slot < RIVER_HOPPER_GOAL_COLUMNS.length; slot += 1) {
      const x = riverHopperGoalCenter(slot);
      const filled = simulation.filledGoals[slot] === true;
      renderer.strokeCircle(x, riverHopperRowCenter(0), 8, filled ? "#ffe47b" : "#74a88a", 1.5);
      if (filled) {
        renderer.fillCircle(x, riverHopperRowCenter(0), 4.2, "#ffe47b");
      }
    }

    for (const lane of simulation.lanes) {
      for (const segment of riverHopperLaneSegments(lane)) {
        if (lane.definition.kind === "river") {
          const color = RIVER_PALETTE[lane.definition.palette] ?? "#8b755d";
          renderer.fillRect(segment.x, segment.y + 2, segment.width, segment.height - 4, color);
          renderer.drawLine(segment.x + 4, segment.y + 5, segment.x + segment.width - 4, segment.y + 5, "#d2c08c", 1);
          renderer.drawLine(segment.x + 4, segment.y + 11, segment.x + segment.width - 4, segment.y + 11, "#5d553f", 1);
        } else {
          const color = ROAD_PALETTE[lane.definition.palette] ?? "#d28462";
          renderer.fillRect(segment.x, segment.y + 3, segment.width, segment.height - 6, color);
          renderer.fillRect(segment.x + 4, segment.y + 5, Math.max(3, segment.width - 8), 3, "#d9f2f2");
          renderer.fillCircle(segment.x + 5, segment.y + 13, 2, "#15171b");
          renderer.fillCircle(segment.x + segment.width - 5, segment.y + 13, 2, "#15171b");
        }
      }
    }

    if (!simulation.gameOver) {
      renderPlayer(
        renderer,
        simulation.player.position.x,
        simulation.player.position.y,
        simulation.player.moving,
      );
    }

    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 7, 6, {
      color: "#e5f5f2",
      font: "bold 8px monospace",
      baseline: "top",
    });
    renderer.drawText(`LIVES ${simulation.lives}`, 100, 6, {
      color: "#ffd484",
      font: "bold 8px monospace",
      baseline: "top",
    });
    renderer.drawText(`ROUND ${simulation.round}`, 190, 6, {
      color: "#b8e986",
      font: "bold 8px monospace",
      baseline: "top",
    });
    renderer.drawText(simulation.stage.label.toUpperCase(), 313, 6, {
      color: "#86d7ff",
      font: "bold 8px monospace",
      align: "right",
      baseline: "top",
    });

    const timeRatio = Math.max(
      0,
      Math.min(
        1,
        simulation.timeRemainingSeconds /
          RIVER_HOPPER_DIFFICULTIES[
            (this.runOptions?.difficulty ?? "channel") as RiverHopperDifficultyId
          ].timeSeconds,
      ),
    );
    renderer.drawText("TIME", 7, 19, {
      color: "#adc6cf",
      font: "7px monospace",
      baseline: "middle",
    });
    renderer.strokeRect(36, 16, 88, 6, "#61717a", 1);
    renderer.fillRect(37, 17, 86 * timeRatio, 4, timeRatio < 0.25 ? "#ff836f" : "#68d3ae");

    if (simulation.gameOver) {
      renderer.fillRect(72, 102, 176, 46, "#151b24");
      renderer.strokeRect(72, 102, 176, 46, "#ff8b73", 1.5);
      renderer.drawText("CROSSING COMPLETE", 160, 116, {
        color: "#ffb08e",
        font: "bold 13px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", 160, 136, {
        color: "#e5f5f2",
        font: "7px monospace",
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
    this.consumedPresses.clear();
  }

  private readDirectionPress(): RiverHopperDirection | null {
    let selected: RiverHopperDirection | null = null;
    for (const direction of DIRECTIONS) {
      const pressed = this.services.input.wasPressed(1, direction);
      if (!pressed) {
        this.consumedPresses.delete(direction);
        continue;
      }
      if (!this.consumedPresses.has(direction) && selected === null) {
        selected = direction;
      }
      this.consumedPresses.add(direction);
    }
    return selected;
  }
}

export const RIVER_HOPPER_MODULE: GameModule = Object.freeze({
  metadata: RIVER_HOPPER_METADATA,
  create: (services: GameServices) => new RiverHopperGameInstance(services),
  resolveAssetUrl: assetUrl,
});

export { RIVER_HOPPER_AUDIO_IDS };
