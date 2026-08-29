import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
import type { JungleQuestSimulationEvent } from "./simulation.js";

export const JUNGLE_QUEST_AUDIO_IDS = Object.freeze({
  jump: "jungle-quest.audio.jump",
  relic: "jungle-quest.audio.relic",
  hit: "jungle-quest.audio.hit",
  vine: "jungle-quest.audio.vine-loop",
  checkpoint: "jungle-quest.audio.checkpoint",
  finish: "jungle-quest.audio.finish",
});

export const JUNGLE_QUEST_EFFECT_RULES = Object.freeze({
  maxParticles: 48,
  relicParticles: 8,
  hitParticles: 10,
  checkpointParticles: 10,
  finishParticles: 20,
});

const PARTICLE_RADIUS = 1.4;
const PARTICLE_LIFETIME_SECONDS = 0.4;

export class JungleQuestEffects {
  private readonly particles = new ParticleBurstField({
    maxParticles: JUNGLE_QUEST_EFFECT_RULES.maxParticles,
  });
  private vineLoopActive = false;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
  }

  public setVineActive(active: boolean): void {
    if (active === this.vineLoopActive) {
      return;
    }
    this.vineLoopActive = active;
    if (active) {
      this.audio.playLoop(JUNGLE_QUEST_AUDIO_IDS.vine, "sfx");
    } else {
      this.audio.stop(JUNGLE_QUEST_AUDIO_IDS.vine);
    }
  }

  public handle(events: readonly JungleQuestSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "jumped":
          this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.jump);
          break;
        case "vine-latched":
          this.setVineActive(true);
          break;
        case "vine-released":
          this.setVineActive(false);
          break;
        case "relic-collected":
          this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.relic);
          this.spawnBurst(event.position, JUNGLE_QUEST_EFFECT_RULES.relicParticles, 34, "#f7d76c");
          break;
        case "player-hit":
          this.setVineActive(false);
          this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.hit);
          this.spawnBurst(event.position, JUNGLE_QUEST_EFFECT_RULES.hitParticles, 42, "#ff826f");
          break;
        case "checkpoint":
          this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.checkpoint);
          this.spawnBurst(
            event.position,
            JUNGLE_QUEST_EFFECT_RULES.checkpointParticles,
            26,
            "#8fe388",
          );
          break;
        case "run-ended":
          this.setVineActive(false);
          if (event.reason === "completed") {
            this.audio.playEffect(JUNGLE_QUEST_AUDIO_IDS.finish);
            this.spawnBurst(
              { x: 160, y: 112 },
              JUNGLE_QUEST_EFFECT_RULES.finishParticles,
              48,
              "#ffe08a",
            );
          }
          break;
        case "room-changed":
          break;
      }
    }
  }

  public update(dtSeconds: number): void {
    this.particles.update(dtSeconds);
  }

  public render(renderer: GameRenderer): void {
    this.particles.render(renderer);
  }

  public destroy(): void {
    this.setVineActive(false);
    this.particles.clear();
  }

  private spawnBurst(position: Vector2, count: number, speed: number, color: string): void {
    this.particles.burst({
      x: position.x,
      y: position.y,
      count,
      speed,
      lifetimeSeconds: PARTICLE_LIFETIME_SECONDS,
      radius: PARTICLE_RADIUS,
      color,
    });
  }
}
