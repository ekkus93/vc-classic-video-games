import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
} from "../../engine/index.js";
import {
  MISSILE_DEFENSE_DIFFICULTIES,
  MISSILE_DEFENSE_RUN_RULES,
  type MissileDefenseDifficultyId,
} from "./design.js";
import { MissileDefenseEffects } from "./effects.js";
import { MISSILE_DEFENSE_METADATA } from "./metadata.js";
import { MissileDefenseScoreCommitter } from "./score-submission.js";
import { MissileDefenseSimulation } from "./simulation.js";

function resolveDifficulty(value: string): MissileDefenseDifficultyId {
  if (!Object.hasOwn(MISSILE_DEFENSE_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Missile Defense difficulty: ${value}`);
  }
  return value as MissileDefenseDifficultyId;
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/launch.wav":
      return new URL("./audio/launch.wav", import.meta.url).href;
    case "audio/blast.wav":
      return new URL("./audio/blast.wav", import.meta.url).href;
    case "audio/intercept.wav":
      return new URL("./audio/intercept.wav", import.meta.url).href;
    case "audio/ground-hit.wav":
      return new URL("./audio/ground-hit.wav", import.meta.url).href;
    case "audio/wave-clear.wav":
      return new URL("./audio/wave-clear.wav", import.meta.url).href;
    default:
      return null;
  }
}

export class MissileDefenseGameInstance implements GameInstance {
  private simulation: MissileDefenseSimulation | null = null;
  private effects: MissileDefenseEffects;
  private readonly scoreCommitter: MissileDefenseScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;
  private fireLatched = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new MissileDefenseEffects(services.audio);
    this.scoreCommitter = new MissileDefenseScoreCommitter(
      services.scores,
      (error) => services.logger.error("Missile Defense score persistence failed", error),
    );
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Missile Defense supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new MissileDefenseEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new MissileDefenseSimulation({
      rng: this.services.rng,
      difficulty,
    });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
    this.fireLatched = false;
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
    const xAxis: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    const yAxis: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;
    const pointer = this.services.input.pointer.snapshot();
    if (this.services.input.wasReleased(1, "action-1") || pointer.primaryReleased) {
      this.fireLatched = false;
    }
    const rawFire =
      this.services.input.isHeld(1, "action-1") ||
      this.services.input.wasPressed(1, "action-1") ||
      pointer.primaryHeld ||
      pointer.primaryPressed;
    const fire = rawFire && !this.fireLatched;
    this.fireLatched = rawFire;
    const events = simulation.update({ xAxis, yAxis, fire, pointer }, dtSeconds);
    this.effects.handle(events);
    this.scoreCommitter.handle(events);
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#071018");
    renderer.fillRect(
      0,
      MISSILE_DEFENSE_RUN_RULES.groundY,
      renderer.logicalWidth,
      renderer.logicalHeight - MISSILE_DEFENSE_RUN_RULES.groundY,
      "#182a25",
    );
    renderer.drawLine(
      0,
      MISSILE_DEFENSE_RUN_RULES.groundY,
      renderer.logicalWidth,
      MISSILE_DEFENSE_RUN_RULES.groundY,
      "#6fa36d",
      2,
    );

    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText(
        "MISSILE DEFENSE",
        renderer.logicalWidth / 2,
        renderer.logicalHeight / 2,
        { color: "#8fe7e0", font: "bold 17px monospace", align: "center", baseline: "middle" },
      );
      return;
    }

    for (const city of simulation.ground.cities) {
      if (city.alive) {
        renderer.fillRect(city.position.x - 8, city.position.y - 8, 16, 8, "#67c4b4");
        renderer.fillRect(city.position.x - 3, city.position.y - 13, 6, 5, "#9ce0c7");
      } else {
        renderer.drawLine(city.position.x - 7, city.position.y, city.position.x + 7, city.position.y - 5, "#6f4a43", 2);
        renderer.drawLine(city.position.x - 5, city.position.y - 6, city.position.x + 6, city.position.y, "#6f4a43", 2);
      }
    }

    for (const battery of simulation.ground.batteries) {
      if (battery.alive) {
        renderer.fillPolygon(
          [
            { x: battery.position.x - 9, y: battery.position.y + 2 },
            { x: battery.position.x, y: battery.position.y - 8 },
            { x: battery.position.x + 9, y: battery.position.y + 2 },
          ],
          "#d3b45c",
        );
      } else {
        renderer.fillRect(battery.position.x - 8, battery.position.y - 2, 16, 4, "#664d3d");
      }
      renderer.drawText(String(battery.ammo), battery.position.x, battery.position.y + 7, {
        color: battery.ammo > 0 && battery.alive ? "#ffe391" : "#8c7565",
        font: "bold 8px monospace",
        align: "center",
        baseline: "top",
      });
    }

    for (const missile of simulation.enemies) {
      renderer.drawLine(
        missile.start.x,
        missile.start.y,
        missile.position.x,
        missile.position.y,
        "#d45d6f",
        1,
      );
      renderer.fillCircle(missile.position.x, missile.position.y, 1.6, "#ff9d76");
    }
    for (const interceptor of simulation.activeInterceptors) {
      renderer.drawLine(
        interceptor.position.x,
        interceptor.position.y,
        interceptor.target.x,
        interceptor.target.y,
        "#406d70",
        1,
      );
      renderer.fillCircle(interceptor.position.x, interceptor.position.y, 1.5, "#b8fff1");
    }
    for (const explosion of simulation.activeExplosions) {
      renderer.strokeCircle(
        explosion.position.x,
        explosion.position.y,
        explosion.radius,
        explosion.chain ? "#ffd16f" : "#8ff7e8",
        2,
      );
      renderer.fillCircle(explosion.position.x, explosion.position.y, 1.5, "#fff4c1");
    }

    const cursor = simulation.cursor;
    renderer.drawLine(cursor.x - 6, cursor.y, cursor.x + 6, cursor.y, "#d8fff8", 1);
    renderer.drawLine(cursor.x, cursor.y - 6, cursor.x, cursor.y + 6, "#d8fff8", 1);
    renderer.strokeCircle(cursor.x, cursor.y, 4, "#75e5d8", 1);

    renderer.drawText(`SCORE ${simulation.score}`, 8, 7, {
      color: "#d8fff8",
      font: "bold 9px monospace",
      baseline: "top",
    });
    renderer.drawText(`WAVE ${simulation.wave}`, renderer.logicalWidth / 2, 7, {
      color: "#ffe391",
      font: "bold 9px monospace",
      align: "center",
      baseline: "top",
    });
    renderer.drawText(
      `CITIES ${simulation.ground.cities.filter((city) => city.alive).length}`,
      renderer.logicalWidth - 8,
      7,
      {
        color: "#9ce0c7",
        font: "bold 9px monospace",
        align: "right",
        baseline: "top",
      },
    );

    if (simulation.gameOver) {
      renderer.drawText("DEFENSE ENDED", renderer.logicalWidth / 2, renderer.logicalHeight / 2 - 5, {
        color: "#ff8b79",
        font: "bold 15px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText(
        "Pause to restart or return",
        renderer.logicalWidth / 2,
        renderer.logicalHeight / 2 + 13,
        { color: "#d8fff8", font: "8px monospace", align: "center", baseline: "middle" },
      );
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
    this.fireLatched = false;
  }
}

export const MISSILE_DEFENSE_MODULE: GameModule = Object.freeze({
  metadata: MISSILE_DEFENSE_METADATA,
  create: (services: GameServices) => new MissileDefenseGameInstance(services),
  resolveAssetUrl: assetUrl,
});
