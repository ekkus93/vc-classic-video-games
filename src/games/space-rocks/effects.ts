import type {
  AudioService,
  GameRenderer,
  Vector2,
} from "../../engine/index.js";
import { SPACE_ROCKS_RUN_RULES } from "./design.js";
import type { SpaceRocksSimulationEvent } from "./simulation.js";

export const SPACE_ROCKS_AUDIO_IDS = Object.freeze({
  thrust: "space-rocks.audio.thrust",
  pulse: "space-rocks.audio.pulse",
  fracture: "space-rocks.audio.fracture",
  hullHit: "space-rocks.audio.hull-hit",
  waveClear: "space-rocks.audio.wave-clear",
});

export const SPACE_ROCKS_EFFECT_RULES = Object.freeze({
  maxParticles: 64,
  pulseParticles: 2,
  fractureParticles: 8,
  hullHitParticles: 14,
  waveClearParticles: 18,
});

interface SpaceRocksParticle {
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

const CENTER = Object.freeze({
  x: SPACE_ROCKS_RUN_RULES.logicalWidth / 2,
  y: SPACE_ROCKS_RUN_RULES.logicalHeight / 2,
});

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

export class SpaceRocksEffects {
  private particlesValue: readonly SpaceRocksParticle[] = Object.freeze([]);
  private thrustLoopActive = false;
  private burstSerial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
  }

  public setThrust(active: boolean): void {
    if (active === this.thrustLoopActive) {
      return;
    }
    this.thrustLoopActive = active;
    if (active) {
      this.audio.playLoop(SPACE_ROCKS_AUDIO_IDS.thrust, "sfx");
    } else {
      this.audio.stop(SPACE_ROCKS_AUDIO_IDS.thrust);
    }
  }

  public handle(events: readonly SpaceRocksSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "pulse-fired":
          this.audio.playEffect(SPACE_ROCKS_AUDIO_IDS.pulse);
          this.spawnBurst(event.position, {
            count: SPACE_ROCKS_EFFECT_RULES.pulseParticles,
            speed: 18,
            lifetimeSeconds: 0.12,
            radius: 1,
            color: "#7fe7ff",
          });
          break;
        case "rock-fractured":
          this.audio.playEffect(SPACE_ROCKS_AUDIO_IDS.fracture);
          this.spawnBurst(event.position, {
            count: SPACE_ROCKS_EFFECT_RULES.fractureParticles,
            speed: 34,
            lifetimeSeconds: 0.32,
            radius: 1.5,
            color: "#f6b94a",
          });
          break;
        case "ship-hit":
          this.audio.playEffect(SPACE_ROCKS_AUDIO_IDS.hullHit);
          this.spawnBurst(event.position, {
            count: SPACE_ROCKS_EFFECT_RULES.hullHitParticles,
            speed: 42,
            lifetimeSeconds: 0.42,
            radius: 1.5,
            color: "#ff806a",
          });
          break;
        case "wave-cleared":
          this.audio.playEffect(SPACE_ROCKS_AUDIO_IDS.waveClear);
          this.spawnBurst(CENTER, {
            count: SPACE_ROCKS_EFFECT_RULES.waveClearParticles,
            speed: 28,
            lifetimeSeconds: 0.48,
            radius: 1.25,
            color: "#a7f3d0",
          });
          break;
        case "game-over":
          this.setThrust(false);
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
    if (this.thrustLoopActive) {
      this.audio.stop(SPACE_ROCKS_AUDIO_IDS.thrust);
      this.thrustLoopActive = false;
    }
    this.particlesValue = Object.freeze([]);
  }

  private spawnBurst(position: Vector2, style: BurstStyle): void {
    const available = Math.max(
      0,
      SPACE_ROCKS_EFFECT_RULES.maxParticles - this.particlesValue.length,
    );
    const count = Math.min(style.count, available);
    if (count === 0) {
      return;
    }

    const next = [...this.particlesValue];
    const phase = (this.burstSerial * 0.61803398875) % 1;
    this.burstSerial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / Math.max(1, count));
      const speedScale = 0.65 + ((index * 7 + this.burstSerial) % 5) * 0.1;
      next.push(
        Object.freeze({
          position: Object.freeze({ ...position }),
          velocity: Object.freeze({
            x: Math.cos(angle) * style.speed * speedScale,
            y: Math.sin(angle) * style.speed * speedScale,
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
