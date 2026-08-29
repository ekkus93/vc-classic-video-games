import type {
  AudioService,
  GameRenderer,
  ParticleBurstStyle,
  Vector2,
} from "../../engine/index.js";
import { ParticleBurstField } from "../../engine/index.js";
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

export class StarDefenderEffects {
  private readonly particles = new ParticleBurstField({
    maxParticles: STAR_DEFENDER_EFFECT_RULES.maxParticles,
    speedScaleBase: 0.68,
    indexStride: 5,
  });
  private engineLoopActive = false;

  public constructor(private readonly audio: AudioService) {}

  public get particleCount(): number {
    return this.particles.count;
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
    this.particles.update(dtSeconds);
  }

  /**
   * Star Defender's field scrolls, so particles are drawn against the camera and culled at the
   * screen edges rather than through the shared field's plain presentation.
   */
  public render(renderer: GameRenderer, cameraCenterX: number): void {
    for (const particle of this.particles.particles) {
      const screenX = starDefenderWorldToScreenX(particle.x, cameraCenterX);
      if (screenX >= -4 && screenX <= STAR_DEFENDER_RUN_RULES.logicalWidth + 4) {
        renderer.fillCircle(screenX, particle.y, particle.radius, particle.color);
      }
    }
  }

  public destroy(): void {
    if (this.engineLoopActive) {
      this.audio.stop(STAR_DEFENDER_AUDIO_IDS.engine);
      this.engineLoopActive = false;
    }
    this.particles.clear();
  }

  private spawnBurst(position: Vector2, style: ParticleBurstStyle): void {
    this.particles.burst({ x: position.x, y: position.y, ...style });
  }
}
