import type { AudioService, GameRenderer } from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
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

const PARTICLE_RADIUS = 1.25;

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
  private readonly particles = new ParticleBurstField({
    maxParticles: MAZE_CHASE_EFFECT_RULES.maxParticles,
    speedScaleBase: 0.72,
    speedScaleStep: 0.09,
  });

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
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
    this.particles.update(dtSeconds);
  }

  public render(renderer: GameRenderer): void {
    this.particles.render(renderer);
  }

  public destroy(): void {
    this.particles.clear();
  }

  private burst(
    position: { readonly x: number; readonly y: number },
    count: number,
    color: string,
    speed: number,
    lifetimeSeconds: number,
  ): void {
    const center = toScreen(position);
    this.particles.burst({
      x: center.x,
      y: center.y,
      count,
      speed,
      lifetimeSeconds,
      radius: PARTICLE_RADIUS,
      color,
    });
  }
}
