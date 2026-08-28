import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import { STAR_DEFENDER_RUN_RULES } from "./design.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";
import { starDefenderWorldToScreenX } from "./world.js";

export const STAR_DEFENDER_AUDIO_IDS = Object.freeze({
  engine: "star-defender.audio.engine",
  lance: "star-defender.audio.lance",
  emergency: "star-defender.audio.emergency",
  impact: "star-defender.audio.impact",
  rescue: "star-defender.audio.rescue",
  wave: "star-defender.audio.wave",
});

export const STAR_DEFENDER_EFFECT_RULES = Object.freeze({
  maxParticles: 72,
});

interface Particle {
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

export class StarDefenderEffects {
  private particlesValue: readonly Particle[] = Object.freeze([]);
  private engineLoopActive = false;
  private burstSerial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
  }

  public setEngine(active: boolean): void {
    if (active === this.engineLoopActive) {
      return;
    }
    this.engineLoopActive = active;
    if (active) {
      this.audio.playLoop(STAR_DEFENDER_AUDIO_IDS.engine, "sfx");
    } else {
      this.audio.stop(STAR_DEFENDER_AUDIO_IDS.engine);
    }
  }

  public handle(events: readonly StarDefenderSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "lance-fired":
          this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.lance);
          this.spawnBurst(event.position, {
            count: 2,
            speed: 18,
            lifetimeSeconds: 0.11,
            radius: 1,
            color: "#aef8ff",
          });
          break;
        case "emergency-used":
          this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.emergency);
          this.spawnBurst(event.position, {
            count: 24,
            speed: 76,
            lifetimeSeconds: 0.42,
            radius: 1.4,
            color: "#ffe66d",
          });
          break;
        case "enemy-destroyed":
          if (event.cause === "lance") {
            this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.impact);
          }
          this.spawnBurst(event.position, {
            count: 6,
            speed: 34,
            lifetimeSeconds: 0.28,
            radius: 1.25,
            color: "#ff8d66",
          });
          break;
        case "inhabitant-falling":
        case "abduction-started":
        case "inhabitant-lost":
          break;
        case "inhabitant-caught":
        case "inhabitant-returned":
          this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.rescue);
          break;
        case "player-hit":
          this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.impact);
          this.spawnBurst(event.position, {
            count: 14,
            speed: 48,
            lifetimeSeconds: 0.38,
            radius: 1.5,
            color: "#ff5f6d",
          });
          break;
        case "wave-cleared":
          this.audio.playEffect(STAR_DEFENDER_AUDIO_IDS.wave);
          break;
        case "game-over":
          this.setEngine(false);
          break;
      }
    }
  }

  public update(dtSeconds: number): void {
    requireDelta(dtSeconds);
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

  public render(renderer: GameRenderer, cameraCenterX: number): void {
    for (const particle of this.particlesValue) {
      const screenX = starDefenderWorldToScreenX(
        particle.position.x,
        cameraCenterX,
      );
      if (
        screenX >= -4 &&
        screenX <= STAR_DEFENDER_RUN_RULES.logicalWidth + 4
      ) {
        renderer.fillCircle(
          screenX,
          particle.position.y,
          particle.radius,
          particle.color,
        );
      }
    }
  }

  public destroy(): void {
    if (this.engineLoopActive) {
      this.audio.stop(STAR_DEFENDER_AUDIO_IDS.engine);
      this.engineLoopActive = false;
    }
    this.particlesValue = Object.freeze([]);
  }

  private spawnBurst(position: Vector2, style: BurstStyle): void {
    const available = Math.max(
      0,
      STAR_DEFENDER_EFFECT_RULES.maxParticles - this.particlesValue.length,
    );
    const count = Math.min(style.count, available);
    if (count === 0) {
      return;
    }
    const next = [...this.particlesValue];
    const phase = (this.burstSerial * 0.38196601125) % 1;
    this.burstSerial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const speed = style.speed * (0.68 + ((index * 5 + this.burstSerial) % 4) * 0.1);
      next.push(
        Object.freeze({
          position: Object.freeze({ ...position }),
          velocity: Object.freeze({
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
          }),
          ageSeconds: 0,
          lifetimeSeconds: style.lifetimeSeconds,
          radius: style.radius,
          color: style.color,
        }),
      );
    }
    this.particlesValue = Object.freeze(next);
  }
}
