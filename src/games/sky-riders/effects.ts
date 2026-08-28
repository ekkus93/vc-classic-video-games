import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import type { SkyRidersSimulationEvent } from "./simulation.js";

export const SKY_RIDERS_AUDIO_IDS = Object.freeze({
  flap: "sky-riders.audio.flap",
  clash: "sky-riders.audio.clash",
  defeat: "sky-riders.audio.defeat",
  hit: "sky-riders.audio.hit",
  recovery: "sky-riders.audio.recovery",
  waveClear: "sky-riders.audio.wave-clear",
});

export const SKY_RIDERS_EFFECT_RULES = Object.freeze({
  maxParticles: 72,
  flapParticles: 3,
  clashParticles: 7,
  defeatParticles: 10,
  hitParticles: 12,
  recoveryParticles: 9,
  waveClearParticles: 18,
});

interface SkyRidersParticle {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly ageSeconds: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}
interface BurstStyle {
  readonly count: number;
  readonly speed: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}
function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export class SkyRidersEffects {
  private particleState: readonly SkyRidersParticle[] = Object.freeze([]);
  private burstSerial = 0;
  public constructor(private readonly audio: AudioService) {}
  public get particleCount(): number { return this.particleState.length; }
  public handle(events: readonly SkyRidersSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "flap":
          if (event.rider === "player") this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.flap);
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.flapParticles, speed: 18, lifetimeSeconds: 0.24, radius: 1, color: event.rider === "player" ? "#bdf4ff" : "#ffc38e" });
          break;
        case "combat-clash":
          this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.clash);
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.clashParticles, speed: 38, lifetimeSeconds: 0.35, radius: 1.4, color: "#fff0a8" });
          break;
        case "enemy-defeated":
          this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.defeat);
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.defeatParticles, speed: 44, lifetimeSeconds: 0.48, radius: 1.6, color: "#ff9a73" });
          break;
        case "player-hit":
          this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.hit);
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.hitParticles, speed: 48, lifetimeSeconds: 0.52, radius: 1.7, color: "#ff657a" });
          break;
        case "storm-seed-collected":
          this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.recovery);
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.recoveryParticles, speed: 34, lifetimeSeconds: 0.42, radius: 1.5, color: "#9effc9" });
          break;
        case "storm-seed-reformed":
          this.burst(event.position, { count: SKY_RIDERS_EFFECT_RULES.recoveryParticles, speed: 28, lifetimeSeconds: 0.45, radius: 1.5, color: "#ffb477" });
          break;
        case "wave-cleared":
          this.audio.playEffect(SKY_RIDERS_AUDIO_IDS.waveClear);
          this.burst({ x: 160, y: 96 }, { count: SKY_RIDERS_EFFECT_RULES.waveClearParticles, speed: 52, lifetimeSeconds: 0.72, radius: 1.8, color: "#d5b8ff" });
          break;
        case "game-over": break;
      }
    }
  }
  public update(dtSeconds: number): void {
    requireDelta(dtSeconds);
    this.particleState = Object.freeze(this.particleState.map((particle) => Object.freeze({
      ...particle,
      position: Object.freeze({ x: particle.position.x + particle.velocity.x * dtSeconds, y: particle.position.y + particle.velocity.y * dtSeconds }),
      ageSeconds: particle.ageSeconds + dtSeconds,
    })).filter((particle) => particle.ageSeconds < particle.lifetimeSeconds));
  }
  public render(renderer: GameRenderer): void {
    for (const particle of this.particleState) {
      const fade = 1 - particle.ageSeconds / particle.lifetimeSeconds;
      renderer.fillCircle(particle.position.x, particle.position.y, Math.max(0.4, particle.radius * fade), particle.color);
    }
  }
  public destroy(): void { this.particleState = Object.freeze([]); }
  private burst(origin: Vector2, style: BurstStyle): void {
    const particles = [...this.particleState];
    for (let index = 0; index < style.count; index += 1) {
      const angle = (Math.PI * 2 * index) / style.count + this.burstSerial * 0.391;
      const speedScale = 0.65 + ((index * 7 + this.burstSerial * 3) % 9) / 20;
      particles.push(Object.freeze({
        position: Object.freeze({ ...origin }),
        velocity: Object.freeze({ x: Math.cos(angle) * style.speed * speedScale, y: Math.sin(angle) * style.speed * speedScale }),
        ageSeconds: 0,
        lifetimeSeconds: style.lifetimeSeconds,
        radius: style.radius,
        color: style.color,
      }));
    }
    this.burstSerial += 1;
    this.particleState = Object.freeze(particles.slice(-SKY_RIDERS_EFFECT_RULES.maxParticles));
  }
}
