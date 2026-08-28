import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import type { JungleQuestSimulationEvent } from "./simulation.js";
export const JUNGLE_QUEST_AUDIO_IDS = Object.freeze({
  jump: "jungle-quest.audio.jump", relic: "jungle-quest.audio.relic", hit: "jungle-quest.audio.hit", vine: "jungle-quest.audio.vine-loop", checkpoint: "jungle-quest.audio.checkpoint", finish: "jungle-quest.audio.finish",
});
export const JUNGLE_QUEST_EFFECT_RULES = Object.freeze({ maxParticles: 48, relicParticles: 8, hitParticles: 10, checkpointParticles: 10, finishParticles: 20 });
interface Particle { readonly position: Vector2; readonly velocity: Vector2; readonly ageSeconds: number; readonly lifetimeSeconds: number; readonly radius: number; readonly color: string; }
function requireDelta(dtSeconds: number): void { if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError("dtSeconds must be a non-negative finite number"); }
export class JungleQuestEffects {
  private particlesValue: readonly Particle[] = Object.freeze([]); private vineLoopActive = false; private burstSerial = 0;
  public constructor(private readonly audio: AudioService) {}
  public get particleCount(): number { return this.particlesValue.length; }
  public setVineActive(active: boolean): void {
    if (active === this.vineLoopActive) return; this.vineLoopActive = active;
    if (active) this.audio.playLoop(JUNGLE_QUEST_AUDIO_IDS.vine, "sfx"); else this.audio.stop(JUNGLE_QUEST_AUDIO_IDS.vine);
  }
  public handle(events: readonly JungleQuestSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "jumped": this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.jump); break;
        case "vine-latched": this.setVineActive(true); break;
        case "vine-released": this.setVineActive(false); break;
        case "relic-collected": this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.relic); this.spawnBurst(event.position, JUNGLE_QUEST_EFFECT_RULES.relicParticles, 34, "#f7d76c"); break;
        case "player-hit": this.setVineActive(false); this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.hit); this.spawnBurst(event.position, JUNGLE_QUEST_EFFECT_RULES.hitParticles, 42, "#ff826f"); break;
        case "checkpoint": this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.checkpoint); this.spawnBurst(event.position, JUNGLE_QUEST_EFFECT_RULES.checkpointParticles, 26, "#8fe388"); break;
        case "run-ended": this.setVineActive(false); if (event.reason === "completed") { this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.finish); this.spawnBurst({ x: 160, y: 112 }, JUNGLE_QUEST_EFFECT_RULES.finishParticles, 48, "#ffe08a"); } break;
        case "room-changed": break;
      }
    }
  }
  public update(dtSeconds: number): void {
    requireDelta(dtSeconds);
    this.particlesValue = Object.freeze(this.particlesValue.map((particle) => Object.freeze({ ...particle, position: Object.freeze({ x: particle.position.x + particle.velocity.x * dtSeconds, y: particle.position.y + particle.velocity.y * dtSeconds }), ageSeconds: particle.ageSeconds + dtSeconds })).filter((particle) => particle.ageSeconds < particle.lifetimeSeconds));
  }
  public render(renderer: GameRenderer): void { for (const particle of this.particlesValue) renderer.fillCircle(particle.position.x, particle.position.y, particle.radius, particle.color); }
  public destroy(): void { this.setVineActive(false); this.particlesValue = Object.freeze([]); }
  private spawnBurst(position: Vector2, desiredCount: number, speed: number, color: string): void {
    const available = Math.max(0, JUNGLE_QUEST_EFFECT_RULES.maxParticles - this.particlesValue.length); const count = Math.min(desiredCount, available); if (count === 0) return;
    const next = [...this.particlesValue]; const phase = (this.burstSerial * 0.38196601125) % 1; this.burstSerial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count); const scale = 0.7 + ((index + this.burstSerial) % 4) * 0.1;
      next.push(Object.freeze({ position: Object.freeze({ ...position }), velocity: Object.freeze({ x: Math.cos(angle) * speed * scale, y: Math.sin(angle) * speed * scale }), ageSeconds: 0, lifetimeSeconds: 0.4, radius: 1.4, color }));
    }
    this.particlesValue = Object.freeze(next);
  }
}
