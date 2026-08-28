import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameServices,
  GameStartOptions,
  Vector2,
} from "../../engine/index.js";
import {
  SKY_RIDERS_DIFFICULTIES,
  SKY_RIDERS_PLATFORMS,
  type SkyRidersDifficultyId,
} from "./design.js";
import { SkyRidersEffects } from "./effects.js";
import { SKY_RIDERS_METADATA } from "./metadata.js";
import type { SkyRidersRiderState } from "./physics.js";
import { SkyRidersScoreCommitter } from "./score-submission.js";
import { SkyRidersSimulation, type SkyRidersPlayerInput } from "./simulation.js";

const CLOUDS = Object.freeze([
  Object.freeze({ x: 24, y: 34, width: 62 }),
  Object.freeze({ x: 128, y: 126, width: 52 }),
  Object.freeze({ x: 234, y: 42, width: 68 }),
  Object.freeze({ x: 276, y: 112, width: 38 }),
]);

function resolveDifficulty(value: string): SkyRidersDifficultyId {
  if (!Object.hasOwn(SKY_RIDERS_DIFFICULTIES, value)) {
    throw new Error(`Unsupported Sky Riders difficulty: ${value}`);
  }
  return value as SkyRidersDifficultyId;
}
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function renderCloud(renderer: GameRenderer, x: number, y: number, width: number): void {
  renderer.fillCircle(x, y, width * 0.16, "#263e67");
  renderer.fillCircle(x + width * 0.22, y - 3, width * 0.2, "#2e4974");
  renderer.fillCircle(x + width * 0.46, y + 1, width * 0.17, "#263e67");
  renderer.fillRect(x, y, width * 0.5, 7, "#263e67");
}
function renderPlatform(renderer: GameRenderer, platform: (typeof SKY_RIDERS_PLATFORMS)[number]): void {
  renderer.fillRect(platform.x, platform.y, platform.width, 5, "#4c617b");
  renderer.fillRect(platform.x + 2, platform.y, platform.width - 4, 2, "#9cd7d4");
  const braceCount = Math.max(1, Math.floor(platform.width / 26));
  for (let index = 0; index < braceCount; index += 1) {
    const braceX = platform.x + ((index + 0.5) * platform.width) / braceCount;
    renderer.drawLine(braceX - 5, platform.y + 5, braceX, platform.y + 10, "#32455e");
    renderer.drawLine(braceX + 5, platform.y + 5, braceX, platform.y + 10, "#32455e");
  }
}
function transformPoints(points: readonly Vector2[], facing: -1 | 1): readonly Vector2[] {
  return Object.freeze(points.map((point) => Object.freeze({ x: point.x * facing, y: point.y })));
}
function renderRider(
  renderer: GameRenderer,
  rider: SkyRidersRiderState,
  bodyColor: string,
  accentColor: string,
  enemy: boolean,
): void {
  renderer.save();
  renderer.translate(rider.position.x, rider.position.y);
  const wingLift = Math.max(-2, Math.min(3, rider.velocity.y * 0.025));
  renderer.fillPolygon(transformPoints([
    { x: -2, y: 0 }, { x: -11, y: -4 - wingLift }, { x: -7, y: 3 }, { x: -1, y: 5 },
  ], rider.facing), bodyColor);
  renderer.fillPolygon(transformPoints([
    { x: 2, y: 0 }, { x: 11, y: -1 + wingLift }, { x: 8, y: 5 }, { x: 1, y: 5 },
  ], rider.facing), bodyColor);
  renderer.fillPolygon(transformPoints([
    { x: -5, y: 3 }, { x: 7, y: 2 }, { x: 10, y: 6 }, { x: 2, y: 7 }, { x: -7, y: 6 },
  ], rider.facing), enemy ? "#713d4a" : "#315c75");
  renderer.fillCircle(0, -4, 3.2, accentColor);
  renderer.fillRect(-2.2, -1, 4.4, 5, accentColor);
  renderer.drawLine(1.5 * rider.facing, -5, 5.5 * rider.facing, -7, accentColor, 1);
  renderer.restore();
}
function renderStormSeed(renderer: GameRenderer, position: Vector2): void {
  renderer.save();
  renderer.translate(position.x, position.y);
  renderer.fillPolygon([{ x: 0, y: -5 }, { x: 4, y: 0 }, { x: 0, y: 5 }, { x: -4, y: 0 }], "#ffcf75");
  renderer.fillCircle(0, 0, 1.3, "#fff6bd");
  renderer.restore();
}
function assetUrl(path: string): string | null {
  switch (path) {
    case "assets.json": return new URL("./assets.json", import.meta.url).href;
    case "audio/flap.wav": return new URL("./audio/flap.wav", import.meta.url).href;
    case "audio/clash.wav": return new URL("./audio/clash.wav", import.meta.url).href;
    case "audio/defeat.wav": return new URL("./audio/defeat.wav", import.meta.url).href;
    case "audio/hit.wav": return new URL("./audio/hit.wav", import.meta.url).href;
    case "audio/recovery.wav": return new URL("./audio/recovery.wav", import.meta.url).href;
    case "audio/wave-clear.wav": return new URL("./audio/wave-clear.wav", import.meta.url).href;
    default: return null;
  }
}

export class SkyRidersGameInstance implements GameInstance {
  private simulation: SkyRidersSimulation | null = null;
  private effects: SkyRidersEffects;
  private readonly scoreCommitter: SkyRidersScoreCommitter;
  private runOptions: GameStartOptions | null = null;
  private paused = false;

  public constructor(private readonly services: GameServices) {
    this.effects = new SkyRidersEffects(services.audio);
    this.scoreCommitter = new SkyRidersScoreCommitter(services.scores, (error) => {
      services.logger.warn(`Sky Riders score persistence failed: ${describeError(error)}`);
    });
  }
  public start(options: GameStartOptions): void {
    if (options.players !== 1 && options.players !== 2) throw new Error("Sky Riders supports one or two local players");
    const difficulty = resolveDifficulty(options.difficulty);
    this.services.rng.reset(options.seed);
    this.effects.destroy();
    this.effects = new SkyRidersEffects(this.services.audio);
    this.scoreCommitter.reset();
    this.simulation = new SkyRidersSimulation({ rng: this.services.rng, difficulty, players: options.players });
    this.runOptions = Object.freeze({ ...options });
    this.paused = false;
  }
  public update(dtSeconds: number): void {
    const simulation = this.simulation;
    if (simulation === null || this.paused) return;
    const inputs: SkyRidersPlayerInput[] = [];
    for (const player of simulation.players) {
      if (!player.active) continue;
      const left = this.services.input.isHeld(player.player, "left");
      const right = this.services.input.isHeld(player.player, "right");
      inputs.push(Object.freeze({
        player: player.player,
        horizontal: left === right ? 0 : left ? -1 : 1,
        flap: this.services.input.wasPressed(player.player, "action-1"),
      }));
    }
    const events = simulation.update(inputs, dtSeconds);
    this.effects.handle(events);
    this.effects.update(dtSeconds);
    this.scoreCommitter.handle(events);
  }
  public render(renderer: GameRenderer): void {
    renderer.clear("#101b38");
    renderer.fillRect(0, 0, renderer.logicalWidth, 48, "#17294b");
    for (const cloud of CLOUDS) renderCloud(renderer, cloud.x, cloud.y, cloud.width);
    for (const platform of SKY_RIDERS_PLATFORMS) renderPlatform(renderer, platform);
    const simulation = this.simulation;
    if (simulation === null) {
      renderer.drawText("SKY RIDERS", renderer.logicalWidth / 2, renderer.logicalHeight / 2, { color: "#a9efff", font: "bold 18px monospace", align: "center", baseline: "middle" });
      return;
    }
    for (const seed of simulation.stormSeeds) renderStormSeed(renderer, seed.position);
    for (const enemy of simulation.enemies) {
      const blink = enemy.rider.invulnerabilitySeconds > 0 && Math.floor(enemy.rider.invulnerabilitySeconds * 12) % 2 === 0;
      if (!blink) renderRider(renderer, enemy.rider, "#e36b55", "#ffc274", true);
    }
    for (const player of simulation.players) {
      if (!player.active) continue;
      const blink = player.rider.invulnerabilitySeconds > 0 && Math.floor(player.rider.invulnerabilitySeconds * 12) % 2 === 0;
      if (blink) continue;
      const colors = player.player === 1 ? (["#55d7e8", "#ffe17a"] as const) : (["#ad8cff", "#8df0c2"] as const);
      renderRider(renderer, player.rider, colors[0], colors[1], false);
    }
    this.effects.render(renderer);
    renderer.drawText(`SCORE ${simulation.score}`, 8, 8, { color: "#e8f5ff", font: "bold 9px monospace", baseline: "top" });
    renderer.drawText(`WAVE ${simulation.wave}`, renderer.logicalWidth / 2, 8, { color: "#cdb9ff", font: "bold 9px monospace", align: "center", baseline: "top" });
    const reserves = simulation.players.map((player) => `P${player.player} ${player.lives}`).join("  ");
    renderer.drawText(reserves, renderer.logicalWidth - 8, 8, { color: "#ffe38c", font: "bold 9px monospace", align: "right", baseline: "top" });
    if (simulation.gameOver) {
      renderer.fillRect(72, 94, 176, 52, "#11182a");
      renderer.strokeRect(72, 94, 176, 52, "#ff8c86", 1);
      renderer.drawText("SKY RUN COMPLETE", renderer.logicalWidth / 2, 111, { color: "#ff9b91", font: "bold 14px monospace", align: "center", baseline: "middle" });
      renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 131, { color: "#e8f5ff", font: "8px monospace", align: "center", baseline: "middle" });
    }
  }
  public pause(): void { this.paused = true; }
  public resume(): void { this.paused = false; }
  public reset(): void { if (this.runOptions !== null) this.start(this.runOptions); }
  public destroy(): void {
    this.effects.destroy();
    this.simulation = null;
    this.runOptions = null;
    this.paused = false;
  }
}

export const SKY_RIDERS_MODULE: GameModule = Object.freeze({
  metadata: SKY_RIDERS_METADATA,
  create: (services: GameServices) => new SkyRidersGameInstance(services),
  resolveAssetUrl: assetUrl,
});
