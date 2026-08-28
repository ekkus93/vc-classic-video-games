import type { AudioService, GameRenderer } from "../../engine/index.js";
import {
  DEEP_DIGGER_RUN_RULES,
} from "./design.js";
import type { DeepDiggerSimulationEvent } from "./simulation.js";
import type { GridCell } from "./terrain.js";

export const DEEP_DIGGER_AUDIO_IDS = Object.freeze({
  dig: "deep-digger.audio.dig",
  pump: "deep-digger.audio.pump",
  defeat: "deep-digger.audio.defeat",
  rock: "deep-digger.audio.rock",
  hit: "deep-digger.audio.hit",
  wave: "deep-digger.audio.wave",
});

export const DEEP_DIGGER_EFFECT_RULES = Object.freeze({
  maxParticles: 56,
});

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageSeconds: number;
  lifetimeSeconds: number;
  radius: number;
  color: string;
}

function cellCenter(cell: GridCell): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x:
      DEEP_DIGGER_RUN_RULES.fieldOriginX +
      cell.column * DEEP_DIGGER_RUN_RULES.tileSize +
      DEEP_DIGGER_RUN_RULES.tileSize / 2,
    y:
      DEEP_DIGGER_RUN_RULES.fieldOriginY +
      cell.row * DEEP_DIGGER_RUN_RULES.tileSize +
      DEEP_DIGGER_RUN_RULES.tileSize / 2,
  });
}

export class DeepDiggerEffects {
  private particles: Particle[] = [];
  private serial = 0;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.length;
  }

  public handle(events: readonly DeepDiggerSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "dug":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.dig);
          this.burst(event.cell, 3, "#c17b46", 16, 0.18);
          break;
        case "pump-fired":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.pump);
          break;
        case "enemy-pressured":
          this.burst(event.cell, 3 + event.stage, "#ffd56a", 14, 0.18);
          break;
        case "enemy-defeated":
        case "enemy-crushed":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.defeat);
          this.burst(event.cell, 10, "#85f0c5", 28, 0.35);
          break;
        case "enemy-phased":
          this.burst(event.cell, 5, "#9b8cff", 18, 0.24);
          break;
        case "rock-loosened":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.rock);
          this.burst(event.cell, 5, "#d4a15d", 12, 0.22);
          break;
        case "rock-falling":
          break;
        case "rock-landed":
          this.burst(event.cell, 8, "#e6c27a", 24, 0.28);
          break;
        case "player-hit":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.hit);
          this.burst(event.cell, 12, "#ff7b72", 30, 0.4);
          break;
        case "wave-cleared":
          this.audio.playEffect(DEEP_DIGGER_AUDIO_IDS.wave);
          this.burst(
            {
              column: Math.floor(DEEP_DIGGER_RUN_RULES.gridColumns / 2),
              row: Math.floor(DEEP_DIGGER_RUN_RULES.gridRows / 2),
            },
            16,
            "#70e0ff",
            34,
            0.5,
          );
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
    this.particles = this.particles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx * dtSeconds,
        y: particle.y + particle.vy * dtSeconds,
        ageSeconds: particle.ageSeconds + dtSeconds,
      }))
      .filter((particle) => particle.ageSeconds < particle.lifetimeSeconds);
  }

  public render(renderer: GameRenderer): void {
    for (const particle of this.particles) {
      renderer.fillCircle(particle.x, particle.y, particle.radius, particle.color);
    }
  }

  public destroy(): void {
    for (const assetId of Object.values(DEEP_DIGGER_AUDIO_IDS)) {
      this.audio.stop(assetId);
    }
    this.particles = [];
  }

  private burst(
    cell: GridCell,
    requestedCount: number,
    color: string,
    speed: number,
    lifetimeSeconds: number,
  ): void {
    const available = Math.max(
      0,
      DEEP_DIGGER_EFFECT_RULES.maxParticles - this.particles.length,
    );
    const count = Math.min(requestedCount, available);
    const center = cellCenter(cell);
    const phase = (this.serial * 0.38196601125) % 1;
    this.serial += 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / Math.max(1, count));
      const speedScale = 0.7 + ((index + this.serial) % 4) * 0.1;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed * speedScale,
        vy: Math.sin(angle) * speed * speedScale,
        ageSeconds: 0,
        lifetimeSeconds,
        radius: 1.1,
        color,
      });
    }
  }
}
