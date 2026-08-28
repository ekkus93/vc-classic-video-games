import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import type { BarrelClimberSimulationEvent } from "./simulation.js";

export const BARREL_CLIMBER_AUDIO_IDS = Object.freeze({
  roll: "barrel-climber.audio.roll",
  jump: "barrel-climber.audio.jump",
  vault: "barrel-climber.audio.vault",
  hit: "barrel-climber.audio.hit",
  goal: "barrel-climber.audio.goal",
});

export const BARREL_CLIMBER_EFFECT_RULES = Object.freeze({
  maxParticles: 48,
  jumpParticles: 3,
  vaultParticles: 7,
  hitParticles: 12,
  goalParticles: 16,
});

interface BarrelClimberParticle {
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

export class BarrelClimberEffects {
  private particlesValue: readonly BarrelClimberParticle[] = Object.freeze([]);
  private rollLoopActive = false;
  private burstSerial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
  }

  public setRolling(active: boolean): void {
    if (active === this.rollLoopActive) {
      return;
    }
    this.rollLoopActive = active;
    if (active) {
      this.audio.playLoop(BARREL_CLIMBER_AUDIO_IDS.roll, "sfx");
    } else {
      this.audio.stop(BARREL_CLIMBER_AUDIO_IDS.roll);
    }
  }

  public handle(events: readonly BarrelClimberSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "jumped":
          this.audio.playEffect(BARREL_CLIMBER_AUDIO_IDS.jump);
          this.spawnBurst(event.position, {
            count: BARREL_CLIMBER_EFFECT_RULES.jumpParticles,
            speed: 18,
            lifetimeSeconds: 0.16,
            radius: 1,
            color: "#79f2d0",
          });
          break;
        case "hazard-spawned":
          break;
        case "hazard-vaulted":
          this.audio.playEffect(BARREL_CLIMBER_AUDIO_IDS.vault);
          this.spawnBurst(event.position, {
            count: BARREL_CLIMBER_EFFECT_RULES.vaultParticles,
            speed: 28,
            lifetimeSeconds: 0.3,
            radius: 1.2,
            color: "#f7d66d",
          });
          break;
        case "player-hit":
          this.audio.playEffect(BARREL_CLIMBER_AUDIO_IDS.hit);
          this.spawnBurst(event.position, {
            count: BARREL_CLIMBER_EFFECT_RULES.hitParticles,
            speed: 36,
            lifetimeSeconds: 0.42,
            radius: 1.4,
            color: "#ff765f",
          });
          break;
        case "stage-cleared":
          this.audio.playEffect(BARREL_CLIMBER_AUDIO_IDS.goal);
          this.spawnBurst(event.position, {
            count: BARREL_CLIMBER_EFFECT_RULES.goalParticles,
            speed: 31,
            lifetimeSeconds: 0.5,
            radius: 1.2,
            color: "#8ee8ff",
          });
          break;
        case "game-over":
          this.setRolling(false);
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
        .map((particle) => Object.freeze({
          ...particle,
          position: Object.freeze({
            x: particle.position.x + particle.velocity.x * dtSeconds,
            y: particle.position.y + particle.velocity.y * dtSeconds,
          }),
          ageSeconds: particle.ageSeconds + dtSeconds,
        }))
        .filter((particle) => particle.ageSeconds < particle.lifetimeSeconds),
    );
  }

  public render(renderer: GameRenderer): void {
    for (const particle of this.particlesValue) {
      renderer.fillCircle(particle.position.x, particle.position.y, particle.radius, particle.color);
    }
  }

  public destroy(): void {
    this.setRolling(false);
    this.particlesValue = Object.freeze([]);
  }

  private spawnBurst(position: Vector2, style: BurstStyle): void {
    const available = Math.max(0, BARREL_CLIMBER_EFFECT_RULES.maxParticles - this.particlesValue.length);
    const count = Math.min(style.count, available);
    if (count === 0) {
      return;
    }
    const next = [...this.particlesValue];
    const phase = (this.burstSerial * 0.38196601125) % 1;
    this.burstSerial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const speed = style.speed * (0.7 + ((index * 5 + this.burstSerial) % 4) * 0.1);
      next.push(Object.freeze({
        position: Object.freeze({ ...position }),
        velocity: Object.freeze({ x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }),
        ageSeconds: 0,
        lifetimeSeconds: style.lifetimeSeconds,
        radius: style.radius,
        color: style.color,
      }));
    }
    this.particlesValue = Object.freeze(next);
  }
}
