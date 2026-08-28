import type { AudioService, GameRenderer, Vector2 } from "../../engine/index.js";
import { RIVER_HOPPER_RUN_RULES, riverHopperGoalCenter, riverHopperRowCenter } from "./design.js";
import type { RiverHopperSimulationEvent } from "./simulation.js";

export const RIVER_HOPPER_AUDIO_IDS = Object.freeze({
  current: "river-hopper.audio.current",
  hop: "river-hopper.audio.hop",
  impact: "river-hopper.audio.impact",
  splash: "river-hopper.audio.splash",
  goal: "river-hopper.audio.goal",
  round: "river-hopper.audio.round",
});

export const RIVER_HOPPER_EFFECT_RULES = Object.freeze({
  maxParticles: 48,
  hopParticles: 2,
  dangerParticles: 10,
  goalParticles: 12,
  roundParticles: 18,
});

interface Particle {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly ageSeconds: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}

interface Burst {
  readonly count: number;
  readonly speed: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}

export class RiverHopperEffects {
  private particlesValue: readonly Particle[] = Object.freeze([]);
  private currentLoopActive = false;
  private serial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
  }

  public startCurrent(): void {
    if (this.currentLoopActive) {
      return;
    }
    this.currentLoopActive = true;
    this.audio.playLoop(RIVER_HOPPER_AUDIO_IDS.current, "music");
  }

  public handle(events: readonly RiverHopperSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "hop-started":
          this.audio.playEffect(RIVER_HOPPER_AUDIO_IDS.hop);
          break;
        case "hop-completed":
          this.spawn(event.position, {
            count: RIVER_HOPPER_EFFECT_RULES.hopParticles,
            speed: 10,
            lifetimeSeconds: 0.15,
            radius: 1,
            color: "#b6f7de",
          });
          break;
        case "life-lost":
          this.audio.playEffect(
            event.reason === "vehicle" ? RIVER_HOPPER_AUDIO_IDS.impact : RIVER_HOPPER_AUDIO_IDS.splash,
          );
          this.spawn(event.position, {
            count: RIVER_HOPPER_EFFECT_RULES.dangerParticles,
            speed: 31,
            lifetimeSeconds: 0.4,
            radius: 1.5,
            color: event.reason === "vehicle" ? "#ff9275" : "#7bd7ff",
          });
          break;
        case "goal-filled":
          this.audio.playEffect(RIVER_HOPPER_AUDIO_IDS.goal);
          this.spawn(
            {
              x: riverHopperGoalCenter(event.slotIndex),
              y: riverHopperRowCenter(RIVER_HOPPER_RUN_RULES.goalRow),
            },
            {
              count: RIVER_HOPPER_EFFECT_RULES.goalParticles,
              speed: 25,
              lifetimeSeconds: 0.46,
              radius: 1.4,
              color: "#ffe47b",
            },
          );
          break;
        case "round-cleared":
          this.audio.playEffect(RIVER_HOPPER_AUDIO_IDS.round);
          this.spawn(
            {
              x: RIVER_HOPPER_RUN_RULES.logicalWidth / 2,
              y: RIVER_HOPPER_RUN_RULES.logicalHeight / 2,
            },
            {
              count: RIVER_HOPPER_EFFECT_RULES.roundParticles,
              speed: 36,
              lifetimeSeconds: 0.58,
              radius: 1.6,
              color: "#c7ff8b",
            },
          );
          break;
        case "game-over":
          break;
      }
    }
  }

  public update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError("dtSeconds must be non-negative and finite");
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
    if (this.currentLoopActive) {
      this.audio.stop(RIVER_HOPPER_AUDIO_IDS.current);
      this.currentLoopActive = false;
    }
    this.particlesValue = Object.freeze([]);
  }

  private spawn(position: Vector2, burst: Burst): void {
    const available = Math.max(
      0,
      RIVER_HOPPER_EFFECT_RULES.maxParticles - this.particlesValue.length,
    );
    const count = Math.min(available, burst.count);
    if (count === 0) {
      return;
    }
    const next = [...this.particlesValue];
    const phase = (this.serial * 0.38196601125) % 1;
    this.serial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const speedScale = 0.68 + ((index + this.serial * 3) % 4) * 0.1;
      next.push(
        Object.freeze({
          position: Object.freeze({ ...position }),
          velocity: Object.freeze({
            x: Math.cos(angle) * burst.speed * speedScale,
            y: Math.sin(angle) * burst.speed * speedScale,
          }),
          ageSeconds: 0,
          lifetimeSeconds: burst.lifetimeSeconds,
          radius: burst.radius,
          color: burst.color,
        }),
      );
    }
    this.particlesValue = Object.freeze(next);
  }
}
