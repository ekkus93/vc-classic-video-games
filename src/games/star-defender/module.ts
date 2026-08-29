import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
  Vector2,
} from "../../engine/index.js";
import {
  STAR_DEFENDER_DIFFICULTIES,
  STAR_DEFENDER_RUN_RULES,
  type StarDefenderDifficultyId,
} from "./design.js";
import { StarDefenderEffects } from "./effects.js";
import type { StarDefenderEnemy } from "./enemies.js";
import type { StarDefenderInhabitant } from "./inhabitants.js";
import { STAR_DEFENDER_METADATA } from "./metadata.js";
import { StarDefenderScoreCommitter } from "./score-submission.js";
import { StarDefenderSimulation } from "./simulation.js";
import {
  starDefenderCameraCenterX,
  starDefenderRadarX,
  starDefenderScreenToWorldX,
  starDefenderTerrainY,
  starDefenderWorldToScreenX,
} from "./world.js";

const RADAR = Object.freeze({ left: 6, top: 19, width: 308, height: 27 });

const STAR_FIELD = Object.freeze(
  Array.from({ length: 68 }, (_, index) =>
    Object.freeze({
      x: (31 + index * 137 + index * index * 17) % STAR_DEFENDER_RUN_RULES.worldWidth,
      y: 55 + ((19 + index * 43 + index * index * 3) % 124),
      radius: index % 11 === 0 ? 1.1 : 0.55,
    }),
  ),
);

function resolveDifficulty(value: string): StarDefenderDifficultyId {
  if (!Object.hasOwn(STAR_DEFENDER_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Star Defender difficulty: ${value}`);
  }
  return value as StarDefenderDifficultyId;
}

function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json":
      return new URL("./assets.json", import.meta.url).href;
    case "audio/engine.wav":
      return new URL("./audio/engine.wav", import.meta.url).href;
    case "audio/lance.wav":
      return new URL("./audio/lance.wav", import.meta.url).href;
    case "audio/emergency.wav":
      return new URL("./audio/emergency.wav", import.meta.url).href;
    case "audio/impact.wav":
      return new URL("./audio/impact.wav", import.meta.url).href;
    case "audio/rescue.wav":
      return new URL("./audio/rescue.wav", import.meta.url).href;
    case "audio/wave.wav":
      return new URL("./audio/wave.wav", import.meta.url).href;
    default:
      return null;
  }
}

function renderPlayer(renderer: GameRenderer, x: number, y: number, facing: -1 | 1): void {
  renderer.save();
  renderer.translate(x, y);
  if (facing < 0) {
    renderer.rotate(Math.PI);
  }
  renderer.fillPolygon(
    [
      { x: 9, y: 0 },
      { x: -5, y: -5 },
      { x: -2, y: 0 },
      { x: -5, y: 5 },
    ],
    "#58e6ff",
  );
  renderer.fillRect(-6, -2, 5, 4, "#ffd85c");
  renderer.restore();
}

function renderEnemy(renderer: GameRenderer, enemy: StarDefenderEnemy, x: number): void {
  switch (enemy.type) {
    case "snatcher":
      renderer.fillPolygon(
        [
          { x, y: enemy.y - 6 },
          { x: x + 8, y: enemy.y },
          { x, y: enemy.y + 5 },
          { x: x - 8, y: enemy.y },
        ],
        "#ff6f91",
      );
      renderer.drawLine(x - 4, enemy.y + 4, x - 7, enemy.y + 9, "#ffd0dc");
      renderer.drawLine(x + 4, enemy.y + 4, x + 7, enemy.y + 9, "#ffd0dc");
      break;
    case "stalker":
      renderer.fillCircle(x, enemy.y, 6, "#ff9b4a");
      renderer.drawLine(x - 9, enemy.y, x + 9, enemy.y, "#ffe0a8", 2);
      break;
    case "skimmer":
      renderer.fillPolygon(
        [
          { x: x - 9, y: enemy.y - 3 },
          { x: x + 7, y: enemy.y - 5 },
          { x: x + 10, y: enemy.y + 3 },
          { x: x - 6, y: enemy.y + 5 },
        ],
        "#b78cff",
      );
      break;
  }
}

function renderInhabitant(
  renderer: GameRenderer,
  inhabitant: StarDefenderInhabitant,
  x: number,
): void {
  if (inhabitant.state === "lost") {
    return;
  }
  const color = inhabitant.state === "falling" ? "#fff2a6" : "#8ff0a4";
  renderer.fillCircle(x, inhabitant.y - 3, 2, color);
  renderer.drawLine(x, inhabitant.y - 1, x, inhabitant.y + 4, color);
  renderer.drawLine(x - 3, inhabitant.y + 1, x + 3, inhabitant.y + 1, color);
  if (inhabitant.state === "falling") {
    renderer.drawLine(x - 4, inhabitant.y - 7, x + 4, inhabitant.y - 7, color);
    renderer.drawLine(x - 4, inhabitant.y - 7, x, inhabitant.y - 3, color);
    renderer.drawLine(x + 4, inhabitant.y - 7, x, inhabitant.y - 3, color);
  }
}

function inRenderRange(screenX: number, margin = 14): boolean {
  return (
    screenX >= -margin &&
    screenX <= STAR_DEFENDER_RUN_RULES.logicalWidth + margin
  );
}

function renderTerrain(renderer: GameRenderer, cameraCenterX: number): void {
  let previous: Vector2 | null = null;
  for (let screenX = -8; screenX <= renderer.logicalWidth + 8; screenX += 8) {
    const worldX = starDefenderScreenToWorldX(screenX, cameraCenterX);
    const point = Object.freeze({ x: screenX, y: starDefenderTerrainY(worldX) });
    if (previous !== null) {
      renderer.drawLine(previous.x, previous.y, point.x, point.y, "#47b27f", 2);
      renderer.drawLine(previous.x, previous.y + 3, point.x, point.y + 3, "#274e4a");
    }
    previous = point;
  }
}

function renderRadar(
  renderer: GameRenderer,
  simulation: StarDefenderSimulation,
): void {
  renderer.fillRect(RADAR.left, RADAR.top, RADAR.width, RADAR.height, "#06172a");
  renderer.strokeRect(RADAR.left, RADAR.top, RADAR.width, RADAR.height, "#4b7891");
  const playerX = starDefenderRadarX(simulation.player.x, RADAR.left, RADAR.width);
  renderer.fillPolygon(
    [
      { x: playerX, y: RADAR.top + 5 },
      { x: playerX - 3, y: RADAR.top + 10 },
      { x: playerX + 3, y: RADAR.top + 10 },
    ],
    "#58e6ff",
  );
  for (const enemy of simulation.enemies) {
    const x = starDefenderRadarX(enemy.x, RADAR.left, RADAR.width);
    const y = RADAR.top + 5 + ((enemy.y - STAR_DEFENDER_RUN_RULES.playfieldTop) / 150) * 12;
    renderer.fillRect(x - 1, y - 1, 3, 3, "#ff776f");
  }
  for (const inhabitant of simulation.inhabitants) {
    if (inhabitant.state === "lost") {
      continue;
    }
    const x = starDefenderRadarX(inhabitant.x, RADAR.left, RADAR.width);
    renderer.drawLine(x, RADAR.top + RADAR.height - 6, x, RADAR.top + RADAR.height - 3, "#8ff0a4");
  }
}

export class StarDefenderGameInstance implements GameInstance {
  private simulation: StarDefenderSimulation | null = null;
  private effects: StarDefenderEffects;
  private readonly scoreCommitter: StarDefenderScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;
  private engineActive = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new StarDefenderEffects(services.audio);
    this.scoreCommitter = new StarDefenderScoreCommitter(
      services.scores,
      (error) => services.logger.warn(`Star Defender score persistence failed: ${String(error)}`),
    );
  }

  public start(options: GameStartOptions): void {
    if (options.players !== 1) {
      throw new Error("Star Defender supports exactly one player");
    }
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new StarDefenderEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new StarDefenderSimulation({
      rng: this.services.rng,
      difficulty,
    });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
    this.engineActive = false;
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
    const fire = this.services.input.isHeld(1, "action-1");
    const emergency = this.services.input.isHeld(1, "action-2");

    this.engineActive =
      !simulation.gameOver && (horizontal !== 0 || vertical !== 0);
    this.effects.setEngine(this.engineActive);
    const events = simulation.update(
      { horizontal, vertical, fire, emergency },
      dtSeconds,
    );
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
    if (simulation.gameOver) {
      this.engineActive = false;
      this.effects.setEngine(false);
    }
  }

  public render(renderer: GameRenderer): void {
    renderer.clear("#020916");
    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText(
        "STAR DEFENDER",
        renderer.logicalWidth / 2,
        renderer.logicalHeight / 2,
        {
          color: "#58e6ff",
          font: "bold 17px monospace",
          align: "center",
          baseline: "middle",
        },
      );
      return;
    }

    const cameraCenterX = starDefenderCameraCenterX(
      simulation.player.x,
      simulation.player.facing,
    );
    for (const star of STAR_FIELD) {
      const x = starDefenderWorldToScreenX(star.x, cameraCenterX);
      if (inRenderRange(x, 2)) {
        renderer.fillCircle(x, star.y, star.radius, "#55708f");
      }
    }
    renderTerrain(renderer, cameraCenterX);

    for (const inhabitant of simulation.inhabitants) {
      const x = starDefenderWorldToScreenX(inhabitant.x, cameraCenterX);
      if (inRenderRange(x)) {
        renderInhabitant(renderer, inhabitant, x);
      }
    }
    for (const enemy of simulation.enemies) {
      const x = starDefenderWorldToScreenX(enemy.x, cameraCenterX);
      if (inRenderRange(x)) {
        renderEnemy(renderer, enemy, x);
      }
    }
    for (const projectile of simulation.projectiles) {
      const x = starDefenderWorldToScreenX(projectile.x, cameraCenterX);
      if (inRenderRange(x, 4)) {
        renderer.drawLine(x - 3, projectile.y, x + 3, projectile.y, "#c9fbff", 2);
      }
    }

    const playerX = starDefenderWorldToScreenX(simulation.player.x, cameraCenterX);
    const protectedBlink =
      simulation.invulnerabilitySeconds > 0 &&
      Math.floor(simulation.invulnerabilitySeconds * 10) % 2 === 0;
    if (!simulation.gameOver && !protectedBlink) {
      renderPlayer(
        renderer,
        playerX,
        simulation.player.y,
        simulation.player.facing,
      );
    }

    renderRadar(renderer, simulation);
    this.effects.render(renderer, cameraCenterX);
    renderer.drawText(`SCORE ${simulation.score}`, 6, 6, {
      color: "#d9f7ff",
      font: "bold 8px monospace",
      baseline: "top",
    });
    renderer.drawText(`WAVE ${simulation.wave}`, renderer.logicalWidth / 2, 6, {
      color: "#a8f0c8",
      font: "bold 8px monospace",
      align: "center",
      baseline: "top",
    });
    renderer.drawText(
      `HULL ${simulation.lives} BURST ${simulation.emergencyCharges}`,
      renderer.logicalWidth - 6,
      6,
      {
        color: "#ffe37c",
        font: "bold 8px monospace",
        align: "right",
        baseline: "top",
      },
    );

    const survivors = simulation.inhabitants.filter(
      (inhabitant) => inhabitant.state !== "lost",
    ).length;
    renderer.drawText(`SETTLERS ${survivors}`, 7, 47, {
      color: "#8ff0a4",
      font: "7px monospace",
      baseline: "top",
    });

    if (simulation.gameOver) {
      renderer.fillRect(74, 99, 172, 43, "#071624");
      renderer.strokeRect(74, 99, 172, 43, "#ff7c72");
      renderer.drawText("DEFENSE ENDED", renderer.logicalWidth / 2, 112, {
        color: "#ff8d83",
        font: "bold 13px monospace",
        align: "center",
        baseline: "middle",
      });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 130, {
        color: "#d9f7ff",
        font: "7px monospace",
        align: "center",
        baseline: "middle",
      });
    }
  }

  public pause(): void {
    this.paused = true;
    this.engineActive = false;
    this.effects.setEngine(false);
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
    this.engineActive = false;
  }
}

export const STAR_DEFENDER_MODULE: GameModule = Object.freeze({
  metadata: STAR_DEFENDER_METADATA,
  create: (services: GameServices) => new StarDefenderGameInstance(services),
  resolveAssetUrl: assetUrl,
});
