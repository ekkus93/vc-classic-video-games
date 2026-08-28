import type { GameInstance, GameModule, GameRenderer, GameServices, GameStartOptions, Vector2 } from "../../engine/index.js";
import { JUNGLE_QUEST_DIFFICULTIES, type JungleQuestDifficultyId } from "./design.js";
import { JungleQuestEffects } from "./effects.js";
import { JUNGLE_QUEST_METADATA } from "./metadata.js";
import { JungleQuestScoreCommitter } from "./score-submission.js";
import { JungleQuestSimulation } from "./simulation.js";
import type { JungleQuestPlatformKind } from "./world.js";
function resolveDifficulty(value: string): JungleQuestDifficultyId { if (!Object.hasOwn(JUNGLE_QUEST_DIFFICULTIES, value)) throw new Error(`Unsupported Jungle Quest difficulty: ${value}`); return value as JungleQuestDifficultyId; }
function assetUrl(path: string): string | null { switch (path) {
  case "assets.json": return new URL("./assets.json", import.meta.url).href;
  case "audio/jump.wav": return new URL("./audio/jump.wav", import.meta.url).href;
  case "audio/relic.wav": return new URL("./audio/relic.wav", import.meta.url).href;
  case "audio/hit.wav": return new URL("./audio/hit.wav", import.meta.url).href;
  case "audio/vine-loop.wav": return new URL("./audio/vine-loop.wav", import.meta.url).href;
  case "audio/checkpoint.wav": return new URL("./audio/checkpoint.wav", import.meta.url).href;
  case "audio/finish.wav": return new URL("./audio/finish.wav", import.meta.url).href;
  default: return null;
} }
function platformColor(kind: JungleQuestPlatformKind): string { switch (kind) { case "surface": return "#8a6b42"; case "ledge": return "#6d824d"; case "tunnel": return "#4b3b4f"; } }
function drawPlatform(renderer: GameRenderer, x1: number, x2: number, y: number, kind: JungleQuestPlatformKind): void { const height = kind === "tunnel" ? 14 : 8; renderer.fillRect(x1, y, x2 - x1, height, platformColor(kind)); renderer.drawLine(x1, y, x2, y, kind === "tunnel" ? "#8a6f8f" : "#a8b56d", 1); }
function drawHazard(renderer: GameRenderer, x: number, y: number, width: number): void { const count = Math.max(2, Math.floor(width / 6)); const step = width / count; for (let index = 0; index < count; index += 1) { const left = x + index * step; renderer.fillPolygon([{ x: left, y: y + 8 }, { x: left + step / 2, y }, { x: left + step, y: y + 8 }], "#d6664d"); } }
function drawRelic(renderer: GameRenderer, position: Vector2): void { renderer.fillPolygon([{ x: position.x, y: position.y - 5 }, { x: position.x + 5, y: position.y }, { x: position.x, y: position.y + 5 }, { x: position.x - 5, y: position.y }], "#f4d96b"); renderer.fillCircle(position.x, position.y, 1.5, "#fff4b0"); }
function drawPlayer(renderer: GameRenderer, position: Vector2, facing: -1 | 1, mode: string): void {
  renderer.save(); renderer.translate(position.x, position.y); if (facing < 0) renderer.rotate(Math.PI);
  renderer.fillRect(-4, -7, 8, 11, "#56c8a8"); renderer.fillCircle(0, -7, 4, "#e8bd7d"); renderer.fillRect(2, -4, 4, 2, "#f2e4b7");
  const legSpread = mode === "air" || mode === "vine" ? 4 : 2; renderer.drawLine(-2, 4, -legSpread, 8, "#253c43", 2); renderer.drawLine(2, 4, legSpread, 8, "#253c43", 2); renderer.restore();
}
export class JungleQuestGameInstance implements GameInstance {
  private simulation: JungleQuestSimulation | null = null; private effects: JungleQuestEffects; private readonly scoreCommitter: JungleQuestScoreCommitter; private runOptions: GameStartOptions | null = null; private paused = false;
  public constructor(private readonly services: GameServices) { this.effects = new JungleQuestEffects(services.audio); this.scoreCommitter = new JungleQuestScoreCommitter(services.scores, (error) => { services.logger.error("Jungle Quest score submission failed", error); }); }
  public start(options: GameStartOptions): void { if (options.players !== 1) throw new Error("Jungle Quest supports exactly one player"); const difficulty = resolveDifficulty(options.difficulty); this.services.rng.reset(options.seed); this.effects.destroy(); this.effects = new JungleQuestEffects(this.services.audio); this.scoreCommitter.reset(); this.simulation = new JungleQuestSimulation({ difficulty }); this.runOptions = Object.freeze({ ...options }); this.paused = false; }
  public update(dtSeconds: number): void {
    const simulation = this.simulation; if (simulation === null || this.paused) return;
    const left = this.services.input.isHeld(1, "left"); const right = this.services.input.isHeld(1, "right"); const up = this.services.input.isHeld(1, "up"); const down = this.services.input.isHeld(1, "down");
    const horizontal: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1; const vertical: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;
    const events = simulation.update({ horizontal, vertical, jumpPressed: this.services.input.wasPressed(1, "action-1"), vinePressed: this.services.input.wasPressed(1, "action-2") }, dtSeconds);
    this.effects.handle(events); this.effects.update(dtSeconds); this.scoreCommitter.handle(events); if (simulation.ended) this.effects.setVineActive(false);
  }
  public render(renderer: GameRenderer): void {
    const simulation = this.simulation;
    if (simulation === null) { renderer.clear("#102f35"); renderer.drawText("JUNGLE QUEST", renderer.logicalWidth / 2, renderer.logicalHeight / 2, { color: "#b7e57f", font: "bold 18px monospace", align: "center", baseline: "middle" }); return; }
    const room = simulation.room; renderer.clear(room.palette.sky); renderer.fillRect(0, 24, renderer.logicalWidth, 30, room.palette.canopy);
    for (let index = 0; index < 13; index += 1) { const x = (index * 29 + room.title.length * 7) % renderer.logicalWidth; renderer.drawLine(x, 38, x - 9, 58 + (index % 3) * 6, "#3c8a59", 3); }
    renderer.fillRect(0, 198, renderer.logicalWidth, 42, room.palette.tunnel);
    for (const platform of room.platforms) drawPlatform(renderer, platform.x1, platform.x2, platform.y, platform.kind);
    for (const ladder of room.ladders) { renderer.drawLine(ladder.x - 4, ladder.yTop, ladder.x - 4, ladder.yBottom, "#c39a63", 2); renderer.drawLine(ladder.x + 4, ladder.yTop, ladder.x + 4, ladder.yBottom, "#c39a63", 2); for (let y = ladder.yTop + 5; y < ladder.yBottom; y += 7) renderer.drawLine(ladder.x - 4, y, ladder.x + 4, y, "#d8b77c", 1); }
    for (const vine of room.vines) { const active = simulation.player.mode === "vine" && simulation.player.vineId === vine.id; const angle = active ? simulation.player.vineAngleRadians : 0; const endX = vine.anchorX + Math.sin(angle) * vine.length; const endY = vine.anchorY + Math.cos(angle) * vine.length; renderer.fillCircle(vine.anchorX, vine.anchorY, 3, "#8dc36b"); renderer.drawLine(vine.anchorX, vine.anchorY, endX, endY, "#77a84f", 2); }
    for (const hazard of room.hazards) drawHazard(renderer, hazard.x, hazard.y, hazard.width);
    for (const collectible of room.collectibles) if (!simulation.hasCollected(collectible.id)) drawRelic(renderer, collectible);
    if (room.id === "sun-shrine") { renderer.strokeRect(292, 150, 22, 40, "#f2cc72", 2); renderer.fillCircle(303, 160, 5, "#f2cc72"); }
    const protectedBlink = simulation.invulnerabilitySeconds > 0 && Math.floor(simulation.invulnerabilitySeconds * 12) % 2 === 0;
    if (!protectedBlink) drawPlayer(renderer, simulation.player.position, simulation.player.facing, simulation.player.mode);
    this.effects.render(renderer); renderer.fillRect(0, 0, renderer.logicalWidth, 24, "#0d252b");
    renderer.drawText(`SCORE ${simulation.score}`, 7, 7, { color: "#eef6d5", font: "bold 8px monospace", baseline: "top" });
    renderer.drawText(`LIVES ${simulation.lives}`, 7, 15, { color: "#f2c46f", font: "bold 8px monospace", baseline: "top" });
    renderer.drawText(room.title.toUpperCase(), renderer.logicalWidth / 2, 7, { color: "#9fe28e", font: "bold 8px monospace", align: "center", baseline: "top" });
    renderer.drawText(`RELICS ${simulation.collectedCount}/4`, renderer.logicalWidth / 2, 15, { color: "#f4d96b", font: "bold 8px monospace", align: "center", baseline: "top" });
    renderer.drawText(`TIME ${Math.ceil(simulation.timeRemainingSeconds)}`, renderer.logicalWidth - 7, 7, { color: "#b9e9ea", font: "bold 8px monospace", align: "right", baseline: "top" });
    if (simulation.ended) { renderer.fillRect(54, 86, 212, 62, "#122329"); renderer.strokeRect(54, 86, 212, 62, "#9bd47c", 1); renderer.drawText(simulation.endReason === "completed" ? "EXPEDITION COMPLETE" : "EXPEDITION ENDED", renderer.logicalWidth / 2, 105, { color: simulation.endReason === "completed" ? "#ffe08a" : "#ff907a", font: "bold 13px monospace", align: "center", baseline: "middle" }); renderer.drawText("Pause to restart or return", renderer.logicalWidth / 2, 128, { color: "#e9f2d0", font: "8px monospace", align: "center", baseline: "middle" }); }
  }
  public pause(): void { this.paused = true; this.effects.setVineActive(false); }
  public resume(): void { this.paused = false; this.effects.setVineActive(this.simulation?.player.mode === "vine"); }
  public reset(): void { if (this.runOptions !== null) this.start(this.runOptions); }
  public destroy(): void { this.effects.destroy(); this.simulation = null; this.runOptions = null; this.paused = false; }
}
export const JUNGLE_QUEST_MODULE: GameModule = Object.freeze({ metadata: JUNGLE_QUEST_METADATA, create: (services: GameServices) => new JungleQuestGameInstance(services), resolveAssetUrl: assetUrl });
