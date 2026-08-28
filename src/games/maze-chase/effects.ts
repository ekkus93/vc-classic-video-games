import type { AudioService, GameRenderer } from "../../engine/index.js";
import { MAZE_CHASE_RUN_RULES } from "./design.js";
import type { MazeChaseSimulationEvent } from "./simulation.js";

export const MAZE_CHASE_AUDIO_IDS = Object.freeze({
  pellet: "maze-chase.audio.pellet",
  power: "maze-chase.audio.power",
  capture: "maze-chase.audio.capture",
  hit: "maze-chase.audio.hit",
  bonus: "maze-chase.audio.bonus",
  levelClear: "maze-chase.audio.level-clear",
});

export const MAZE_CHASE_EFFECT_RULES = Object.freeze({
  maxParticles: 48,
  powerBurst: 10,
  captureBurst: 8,
  hitBurst: 14,
  levelBurst: 18,
});

interface MazeParticle {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly age: number;
  readonly lifetime: number;
  readonly radius: number;
  readonly color: string;
}

function toScreen(position: { readonly x: number; readonly y: number }): {
  readonly x: number;
  readonly y: number;
} {
  return Object.freeze({
    x: MAZE_CHASE_RUN_RULES.mazeOriginX + (position.x + 0.5) * MAZE_CHASE_RUN_RULES.tileSize,
    y: MAZE_CHASE_RUN_RULES.mazeOriginY + (position.y + 0.5) * MAZE_CHASE_RUN_RULES.tileSize,
  });
}

export class MazeChaseEffects {
  private particlesValue: readonly MazeParticle[] = Object.freeze([]);
  private serial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particlesValue.length;
  }

  public handle(events: readonly MazeChaseSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "pellet-collected":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.pellet);
          break;
        case "power-collected":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.power);
          this.burst(event.position, MAZE_CHASE_EFFECT_RULES.powerBurst, "#85f7ff", 26, 0.3);
          break;
        case "enemy-captured":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.capture);
          this.burst(event.position, MAZE_CHASE_EFFECT_RULES.captureBurst, "#fff3a6", 32, 0.28);
          break;
        case "player-hit":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.hit);
          this.burst(event.position, MAZE_CHASE_EFFECT_RULES.hitBurst, "#ff746c", 38, 0.42);
          break;
        case "bonus-collected":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.bonus);
          this.burst(event.position, 8, "#ffdc75", 28, 0.35);
          break;
        case "level-cleared":
          this.audio.playEffect(MAZE_CHASE_AUDIO_IDS.levelClear);
          this.burst(
            { x: 10, y: 8 },
            MAZE_CHASE_EFFECT_RULES.levelBurst,
            "#92ffb3",
            44,
            0.5,
          );
          break;
        case "bonus-appeared":
        case "phase-changed":
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
            x: particle.x + particle.vx * dtSeconds,
            y: particle.y + particle.vy * dtSeconds,
            age: particle.age + dtSeconds,
          }),
        )
        .filter((particle) => particle.age < particle.lifetime),
    );
  }

  public render(renderer: GameRenderer): void {
    for (const particle of this.particlesValue) {
      renderer.fillCircle(particle.x, particle.y, particle.radius, particle.color);
    }
  }

  public destroy(): void {
    this.particlesValue = Object.freeze([]);
  }

  private burst(
    position: { readonly x: number; readonly y: number },
    requestedCount: number,
    color: string,
    speed: number,
    lifetime: number,
  ): void {
    const available = Math.max(
      0,
      MAZE_CHASE_EFFECT_RULES.maxParticles - this.particlesValue.length,
    );
    const count = Math.min(requestedCount, available);
    if (count === 0) {
      return;
    }
    const center = toScreen(position);
    const particles = [...this.particlesValue];
    const phase = (this.serial * 0.38196601125) % 1;
    this.serial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const speedScale = 0.72 + ((index + this.serial) % 4) * 0.09;
      particles.push(
        Object.freeze({
          x: center.x,
          y: center.y,
          vx: Math.cos(angle) * speed * speedScale,
          vy: Math.sin(angle) * speed * speedScale,
          age: 0,
          lifetime,
          radius: 1.25,
          color,
        }),
      );
    }
    this.particlesValue = Object.freeze(particles);
  }
}
