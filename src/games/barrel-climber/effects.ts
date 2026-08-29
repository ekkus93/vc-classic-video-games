import type {
  AudioService,
  GameRenderer,
  ParticleBurstStyle,
  Vector2,
} from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
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

export class BarrelClimberEffects {
  private readonly particles = new ParticleBurstField({
    maxParticles: BARREL_CLIMBER_EFFECT_RULES.maxParticles,
    indexStride: 5,
  });
  private rollLoopActive = false;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
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
    this.particles.update(dtSeconds);
  }

  public render(renderer: GameRenderer): void {
    this.particles.render(renderer);
  }

  public destroy(): void {
    this.setRolling(false);
    this.particles.clear();
  }

  private spawnBurst(position: Vector2, style: ParticleBurstStyle): void {
    this.particles.burst({ x: position.x, y: position.y, ...style });
  }
}
