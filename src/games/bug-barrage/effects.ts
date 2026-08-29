import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
import { BUG_BARRAGE_LIMITS } from "./design.js";
import type { BugBarrageSimulationEvent } from "./simulation.js";

export const BUG_BARRAGE_AUDIO_IDS = Object.freeze({
  spark: "bug-barrage.audio.spark",
  segment: "bug-barrage.audio.segment",
  pod: "bug-barrage.audio.pod",
  hit: "bug-barrage.audio.hit",
  wave: "bug-barrage.audio.wave",
});

const PARTICLE_RADIUS = 1.25;

export class BugBarrageEffects {
  private readonly particles = new ParticleBurstField({
    maxParticles: BUG_BARRAGE_LIMITS.maxEffects,
    phaseStep: 0.41421356237,
    speedScaleBase: 0.65,
  });

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
  }

  public handle(events: readonly BugBarrageSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "spark-fired":
          this.audio.playEffect(BUG_BARRAGE_AUDIO_IDS.spark);
          this.burst(event.position, 2, 15, 0.1, "#9ffcff");
          break;
        case "segment-destroyed":
        case "roamer-destroyed":
          this.audio.playEffect(BUG_BARRAGE_AUDIO_IDS.segment);
          this.burst(event.position, 8, 34, 0.32, "#ffcf5a");
          break;
        case "pod-damaged":
          this.audio.playEffect(BUG_BARRAGE_AUDIO_IDS.pod);
          this.burst(event.position, event.destroyed ? 7 : 3, 22, 0.24, "#8ee67b");
          break;
        case "pod-repaired":
          this.burst(event.position, 3, 14, 0.2, "#8bd8ff");
          break;
        case "player-hit":
          this.audio.playEffect(BUG_BARRAGE_AUDIO_IDS.hit);
          this.burst(event.position, 14, 42, 0.42, "#ff776d");
          break;
        case "wave-cleared":
          this.audio.playEffect(BUG_BARRAGE_AUDIO_IDS.wave);
          this.burst({ x: 160, y: 120 }, 18, 38, 0.5, "#b7ff82");
          break;
        case "game-over":
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
    this.particles.clear();
  }

  private burst(
    position: Vector2,
    count: number,
    speed: number,
    lifetimeSeconds: number,
    color: string,
  ): void {
    this.particles.burst({
      x: position.x,
      y: position.y,
      count,
      speed,
      lifetimeSeconds,
      radius: PARTICLE_RADIUS,
      color,
    });
  }
}
