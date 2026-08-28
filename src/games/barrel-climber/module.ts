import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  BARREL_CLIMBER_DIFFICULTIES,
  BARREL_CLIMBER_RUN_RULES,
  type BarrelClimberDifficultyId,
} from "./design.js";
import { BarrelClimberEffects } from "./effects.js";
import type { BarrelClimberHazard } from "./hazards.js";
import { BARREL_CLIMBER_METADATA } from "./metadata.js";
import type { BarrelClimberPlayerState } from "./player.js";
import { BarrelClimberScoreCommitter } from "./score-submission.js";
import { BarrelClimberSimulation } from "./simulation.js";
import type { BarrelClimberLadder, BarrelClimberPlatform, BarrelClimberStage } from "./stages.js";

function resolveDifficulty(value: string): BarrelClimberDifficultyId {
  if (!Object.hasOwn(BARREL_CLIMBER_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Barrel Climber difficulty: ${value}`);
  }
  return value as BarrelClimberDifficultyId;
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/roll.wav":
      return new URL("./audio/roll.wav", import.meta.url).href;
    case "audio/jump.wav":
      return new URL("./audio/jump.wav", import.meta.url).href;
    case "audio/vault.wav":
      return new URL("./audio/vault.wav", import.meta.url).href;
    case "audio/hit.wav":
      return new URL("./audio/hit.wav", import.meta.url).href;
    case "audio/goal.wav":
      return new URL("./audio/goal.wav", import.meta.url).href;
    default:
      return null;
  }
}

function renderPlatform(renderer: GameRenderer, platform: BarrelClimberPlatform, stage: BarrelClimberStage): void {
  renderer.fillRect(platform.x1, platform.y, platform.x2 - platform.x1, 5, stage.palette.platform);
  renderer.drawLine(platform.x1, platform.y, platform.x2, platform.y, stage.palette.platformEdge, 1);
  for (let x = platform.x1 + 8; x < platform.x2; x += 16) {
    renderer.drawLine(x, platform.y + 1, x + 6, platform.y + 4, stage.palette.platformEdge, 1);
  }
}

function renderLadder(renderer: GameRenderer, ladder: BarrelClimberLadder, stage: BarrelClimberStage): void {
  renderer.drawLine(ladder.x - 4, ladder.yTop, ladder.x - 4, ladder.yBottom, stage.palette.ladder, 1.5);
  renderer.drawLine(ladder.x + 4, ladder.yTop, ladder.x + 4, ladder.yBottom, stage.palette.ladder, 1.5);
  for (let y = ladder.yTop + 5; y < ladder.yBottom; y += 7) {
    renderer.drawLine(ladder.x - 4, y, ladder.x + 4, y, stage.palette.ladder, 1);
  }
}

function renderPlayer(renderer: GameRenderer, player: BarrelClimberPlayerState, blink: boolean): void {
  if (blink) {
    return;
  }
  renderer.save();
  renderer.translate(player.x, player.y - BARREL_CLIMBER_RUN_RULES.playerHeight);
  const facing = player.facing;
  renderer.fillRect(-4, 3, 8, 8, "#35c7b0");
  renderer.fillRect(-3, 0, 6, 4, "#f2cc7c");
  renderer.fillRect(facing > 0 ? 2 : -5, 1, 3, 2, "#182135");
  renderer.fillRect(-5, 11, 4, 3, "#d85d9f");
  renderer.fillRect(1, 11, 4, 3, "#d85d9f");
  renderer.restore();
}

function renderHazard(renderer: GameRenderer, hazard: BarrelClimberHazard, stage: BarrelClimberStage): void {
  const radius = BARREL_CLIMBER_RUN_RULES.hazardRadius;
  renderer.save();
  renderer.translate(hazard.x, hazard.y);
  renderer.rotate(hazard.rotationRadians);
  renderer.fillCircle(0, 0, radius, stage.palette.hazard);
  renderer.strokeCircle(0, 0, radius - 1, "#3f2632", 1);
  renderer.drawLine(-radius + 1, 0, radius - 1, 0, "#ffd56a", 1);
  renderer.drawLine(0, -radius + 1, 0, radius - 1, "#ffd56a", 1);
  renderer.restore();
}

export class BarrelClimberGameInstance implements GameInstance {
  private simulation: BarrelClimberSimulation | null = null;
  private effects: BarrelClimberEffects;
  private readonly scoreCommitter: BarrelClimberScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new BarrelClimberEffects(services.audio);
    this.scoreCommitter = new BarrelClimberScoreCommitter(services.scores, (error) => {
      services.logger.warn(`Barrel Climber score persistence failed: ${String(error)}`);
    });
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Barrel Climber supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new BarrelClimberEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new BarrelClimberSimulation({ rng: this.services.rng, difficulty });
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
    const move: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    const climb: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;
    const jump = this.services.input.wasPressed(1, "action-1");
    const events = simulation.update({ move, climb, jump }, dtSeconds);
    this.effects.handle(events);
    this.effects.setRolling(simulation.hazards.length > 0 && !simulation.gameOver);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    const simulation = this.simulation;
    const stage = simulation?.stage;
    renderer.clear(stage?.palette.background ?? "#100b16");
    if (simulation === null || stage === undefined) {
      renderer.drawText("BARREL CLIMBER", renderer.logicalWidth / 2, renderer.logicalHeight / 2, {
        color: "#79f2d0",
        font: "bold 16px monospace",
        align: "center",
        baseline: "middle",
      });
      return;
    }

    for (const platform of stage.platforms) {
      renderPlatform(renderer, platform, stage);
    }
    for (const ladder of stage.ladders) {
      renderLadder(renderer, ladder, stage);
    }
    for (const hazard of simulation.hazards) {
      renderHazard(renderer, hazard, stage);
    }

    const goalPlatform = stage.platforms.find((platform) => platform.id === stage.goal.platformId);
    if (goalPlatform !== undefined) {
      renderer.fillRect(stage.goal.x - 7, goalPlatform.y - 18, 14, 16, stage.palette.accent);
      renderer.fillRect(stage.goal.x - 3, goalPlatform.y - 22, 6, 4, "#f8f0c8");
      renderer.drawText(stage.goal.label, stage.goal.x, goalPlatform.y - 25, {
        color: stage.palette.accent,
        font: "bold 7px monospace",
        align: "center",
        baseline: "bottom",
      });
    }

    const blink = simulation.invulnerabilitySeconds > 0 && Math.floor(simulation.invulnerabilitySeconds * 10) % 2 === 0;
    if (!simulation.gameOver) {
      renderPlayer(renderer, simulation.player, blink);
    }
    this.effects.render(renderer);

    renderer.fillRect(0, 0, renderer.logicalWidth, 23, "#080a12");
    renderer.drawText(`SCORE ${simulation.score}`, 7, 6, {
      color: "#f3f6ff",
      font: "bold 8px monospace",
      baseline: "top",
    });
    renderer.drawText(`LIVES ${simulation.lives}`, renderer.logicalWidth - 7, 6, {
      color: "#f7cf65",
      font: "bold 8px monospace",
      align: "right",
      baseline: "top",
    });
    renderer.drawText(`L${simulation.level} ${stage.name.toUpperCase()}`, renderer.logicalWidth / 2, 6, {
      color: stage.palette.accent,
      font: "bold 8px monospace",
      align: "center",
      baseline: "top",
    });

    if (simulation.gameOver) {
      renderer.drawText("SHIFT OVER", renderer.logicalWidth / 2, renderer.logicalHeight / 2 - 5, {
        color: "#ff765f",
        font: "bold 15px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, renderer.logicalHeight / 2 + 13, {
        color: "#eef4ff",
        font: "8px monospace",
        align: "center",
        baseline: "middle",
      });
    }
  }

  public pause(): void {
    this.paused = true;
    this.effects.setRolling(false);
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

export const BARREL_CLIMBER_MODULE: GameModule = Object.freeze({
  metadata: BARREL_CLIMBER_METADATA,
  create: (services: GameServices) => new BarrelClimberGameInstance(services),
  resolveAssetUrl: assetUrl,
});
