import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import { BUG_BARRAGE_LIMITS } from "./design.js";
import type { BugBarrageSimulationEvent } from "./simulation.js";

export const BUG_BARRAGE_AUDIO_IDS = Object.freeze({
  spark: "bug-barrage.audio.spark",
  segment: "bug-barrage.audio.segment",
  pod: "bug-barrage.audio.pod",
  hit: "bug-barrage.audio.hit",
  wave: "bug-barrage.audio.wave",
});

interface BugBarrageParticle {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly ageSeconds: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}

export class BugBarrageEffects {
  private particlesValue: readonly BugBarrageParticle[] = Object.freeze([]);
  private burstSerial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
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
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be a non-negative finite number");
    }
    this.particlesValue = Object.freeze(
      this.particlesValue
        .map((particle) =>
          Object.freeze({
            ...particle,
            position: Object.freeze({
              x: particle.position.x + particle.velocity.x * dtSeconds,
              y: particle.position.y + particle.velocity.y * dtSeconds,
            }),
            ageSeconds: particle.ageSeconds + dtSeconds,
          }),
        )
        .filter((particle) => particle.ageSeconds < particle.lifetimeSeconds),
    );
  }

  public render(renderer: GameRenderer): void {
    for (const particle of this.particlesValue) {
      renderer.fillCircle(
        particle.position.x,
        particle.position.y,
        particle.radius,
        particle.color,
      );
    }
  }

  public destroy(): void {
    this.particlesValue = Object.freeze([]);
  }

  private burst(
    position: Vector2,
    requestedCount: number,
    speed: number,
    lifetimeSeconds: number,
    color: string,
  ): void {
    const count = Math.min(
      requestedCount,
      BUG_BARRAGE_LIMITS.maxEffects - this.particlesValue.length,
    );
    if (count <= 0) {
      return;
    }
    const next = [...this.particlesValue];
    const phase = (this.burstSerial * 0.41421356237) % 1;
    this.burstSerial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const speedScale = 0.65 + ((index + this.burstSerial) % 4) * 0.1;
      next.push(
        Object.freeze({
          position: Object.freeze({ ...position }),
          velocity: Object.freeze({
            x: Math.cos(angle) * speed * speedScale,
            y: Math.sin(angle) * speed * speedScale,
          }),
          ageSeconds: 0,
          lifetimeSeconds,
          radius: 1.25,
          color,
        }),
      );
    }
    this.particlesValue = Object.freeze(next);
  }
}
