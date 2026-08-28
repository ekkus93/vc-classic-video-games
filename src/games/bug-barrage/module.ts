import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  BUG_BARRAGE_DIFFICULTIES,
  BUG_BARRAGE_RUN_RULES,
  type BugBarrageDifficultyId,
} from "./design.js";
import { BugBarrageEffects } from "./effects.js";
import { BUG_BARRAGE_METADATA } from "./metadata.js";
import { BugBarrageScoreCommitter } from "./score-submission.js";
import { BugBarrageSimulation } from "./simulation.js";

function resolveDifficulty(value: string): BugBarrageDifficultyId {
  if (!Object.hasOwn(BUG_BARRAGE_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Bug Barrage difficulty: ${value}`);
  }
  return value as BugBarrageDifficultyId;
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/spark.wav":
      return new URL("./audio/spark.wav", import.meta.url).href;
    case "audio/segment.wav":
      return new URL("./audio/segment.wav", import.meta.url).href;
    case "audio/pod.wav":
      return new URL("./audio/pod.wav", import.meta.url).href;
    case "audio/hit.wav":
      return new URL("./audio/hit.wav", import.meta.url).href;
    case "audio/wave.wav":
      return new URL("./audio/wave.wav", import.meta.url).href;
    default:
      return null;
  }
}

export class BugBarrageGameInstance implements GameInstance {
  private simulation: BugBarrageSimulation | null = null;
  private effects: BugBarrageEffects;
  private readonly scoreCommitter: BugBarrageScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new BugBarrageEffects(services.audio);
    this.scoreCommitter = new BugBarrageScoreCommitter(services.scores, (error) => {
      services.logger.warn(`Bug Barrage score persistence failed: ${String(error)}`);
    });
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Bug Barrage supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new BugBarrageEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new BugBarrageSimulation({
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
    const left = this.services.input.isHeld(1, "left");
    const right = this.services.input.isHeld(1, "right");
    const up = this.services.input.isHeld(1, "up");
    const down = this.services.input.isHeld(1, "down");
    const horizontal: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    const vertical: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;
    const events = simulation.update(
      {
        horizontal,
        vertical,
        fire: this.services.input.isHeld(1, "action-1"),
      },
      dtSeconds,
    );
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#07120f");
    renderer.fillRect(
      0,
      BUG_BARRAGE_RUN_RULES.playerRegionTop,
      renderer.logicalWidth,
      BUG_BARRAGE_RUN_RULES.logicalHeight - BUG_BARRAGE_RUN_RULES.playerRegionTop,
      "#0c1b24",
    );
    renderer.drawLine(
      0,
      BUG_BARRAGE_RUN_RULES.playerRegionTop,
      renderer.logicalWidth,
      BUG_BARRAGE_RUN_RULES.playerRegionTop,
      "#2d6f73",
      1,
    );

    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText("BUG BARRAGE", renderer.logicalWidth / 2, renderer.logicalHeight / 2, {
        color: "#b7ff82",
        font: "bold 18px monospace",
        align: "center",
        baseline: "middle",
      });
      return;
    }

    for (const obstacle of simulation.obstacles) {
      const colors = ["#2d704f", "#46945d", "#69bf69"] as const;
      const color = colors[Math.max(0, Math.min(colors.length - 1, obstacle.health - 1))]!;
      renderer.fillCircle(obstacle.position.x, obstacle.position.y, 7, color);
      renderer.fillRect(obstacle.position.x - 2, obstacle.position.y - 7, 4, 14, "#173f36");
      renderer.fillCircle(obstacle.position.x - 3, obstacle.position.y - 2, 1.5, "#b7ff82");
      renderer.fillCircle(obstacle.position.x + 3, obstacle.position.y + 2, 1.5, "#b7ff82");
    }

    for (const chain of simulation.chains) {
      chain.segments.forEach((segment, index) => {
        const head = index === 0;
        renderer.fillCircle(
          segment.position.x,
          segment.position.y,
          head ? 6.5 : 5.5,
          head ? "#ffd25d" : "#e69a42",
        );
        renderer.fillCircle(segment.position.x - 2, segment.position.y - 1, 1, "#24313b");
        renderer.fillCircle(segment.position.x + 2, segment.position.y - 1, 1, "#24313b");
      });
    }

    for (const roamer of simulation.roamers) {
      if (roamer.kind === "skimmer") {
        renderer.fillPolygon(
          [
            { x: roamer.position.x - 7, y: roamer.position.y },
            { x: roamer.position.x, y: roamer.position.y - 5 },
            { x: roamer.position.x + 7, y: roamer.position.y },
            { x: roamer.position.x, y: roamer.position.y + 5 },
          ],
          "#ff6f76",
        );
      } else {
        renderer.strokeCircle(roamer.position.x, roamer.position.y, 6, "#72d7ff", 2);
        renderer.drawLine(
          roamer.position.x - 8,
          roamer.position.y,
          roamer.position.x + 8,
          roamer.position.y,
          "#72d7ff",
          1,
        );
      }
    }

    for (const spark of simulation.sparks) {
      renderer.fillRect(spark.position.x - 1, spark.position.y - 5, 2, 8, "#b8fbff");
    }

    const blink =
      simulation.invulnerabilitySeconds > 0 &&
      Math.floor(simulation.invulnerabilitySeconds * 12) % 2 === 0;
    if (!simulation.gameOver && !blink) {
      const player = simulation.playerPosition;
      renderer.fillPolygon(
        [
          { x: player.x, y: player.y - 8 },
          { x: player.x + 8, y: player.y + 6 },
          { x: player.x + 2, y: player.y + 3 },
          { x: player.x - 2, y: player.y + 3 },
          { x: player.x - 8, y: player.y + 6 },
        ],
        "#75e6c6",
      );
      renderer.fillCircle(player.x, player.y, 2.5, "#f5ff9c");
    }

    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 8, 8, {
      color: "#d8fff4",
      font: "bold 9px monospace",
      baseline: "top",
    });
    renderer.drawText(`WAVE ${simulation.wave}`, renderer.logicalWidth / 2, 8, {
      color: "#b7ff82",
      font: "bold 9px monospace",
      align: "center",
      baseline: "top",
    });
    renderer.drawText(`SHIELDS ${simulation.lives}`, renderer.logicalWidth - 8, 8, {
      color: "#ffd25d",
      font: "bold 9px monospace",
      align: "right",
      baseline: "top",
    });
    if (simulation.gameOver) {
      renderer.drawText("GARDEN LOST", renderer.logicalWidth / 2, 118, {
        color: "#ff837a",
        font: "bold 15px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 136, {
        color: "#d8fff4",
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

export const BUG_BARRAGE_MODULE: GameModule = Object.freeze({
  metadata: BUG_BARRAGE_METADATA,
  create: (services: GameServices) => new BugBarrageGameInstance(services),
  resolveAssetUrl: assetUrl,
});
