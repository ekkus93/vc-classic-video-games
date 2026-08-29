import type {
  AudioService,
  GameRenderer,
  ParticleBurstStyle,
  Vector2,
} from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
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

const CENTER = Object.freeze({
  x: SPACE_ROCKS_RUN_RULES.logicalWidth / 2,
  y: SPACE_ROCKS_RUN_RULES.logicalHeight / 2,
});

export class SpaceRocksEffects {
  private readonly particles = new ParticleBurstField({
    maxParticles: SPACE_ROCKS_EFFECT_RULES.maxParticles,
    phaseStep: 0.61803398875,
    speedScaleBase: 0.65,
    speedScaleSteps: 5,
    indexStride: 7,
  });
  private thrustLoopActive = false;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
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
    this.particles.update(dtSeconds);
  }

  public render(renderer: GameRenderer): void {
    this.particles.render(renderer);
  }

  public destroy(): void {
    if (this.thrustLoopActive) {
      this.audio.stop(SPACE_ROCKS_AUDIO_IDS.thrust);
      this.thrustLoopActive = false;
    }
    this.particles.clear();
  }

  private spawnBurst(position: Vector2, style: ParticleBurstStyle): void {
    this.particles.burst({ x: position.x, y: position.y, ...style });
  }
}
