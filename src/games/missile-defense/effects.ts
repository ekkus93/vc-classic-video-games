import type { AudioService } from "../../engine/index.js";
import type { MissileDefenseSimulationEvent } from "./simulation.js";

export const MISSILE_DEFENSE_AUDIO_IDS = Object.freeze({
  launch: "missile-defense.audio.launch",
  blast: "missile-defense.audio.blast",
  intercept: "missile-defense.audio.intercept",
  groundHit: "missile-defense.audio.ground-hit",
  waveClear: "missile-defense.audio.wave-clear",
});

export class MissileDefenseEffects {
  public constructor(private readonly audio: AudioService) {}

  public handle(events: readonly MissileDefenseSimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "interceptor-fired":
          this.audio.playEffect(MISSILE_DEFENSE_AUDIO_IDS.launch);
          break;
        case "blast-started":
          this.audio.playEffect(MISSILE_DEFENSE_AUDIO_IDS.blast);
          break;
        case "enemy-intercepted":
          this.audio.playEffect(MISSILE_DEFENSE_AUDIO_IDS.intercept);
          break;
        case "ground-hit":
          this.audio.playEffect(MISSILE_DEFENSE_AUDIO_IDS.groundHit);
          break;
        case "wave-cleared":
          this.audio.playEffect(MISSILE_DEFENSE_AUDIO_IDS.waveClear);
          break;
        case "game-over":
          break;
      }
    }
  }

  public destroy(): void {
    // Missile Defense uses only short one-shot effects. Centralized host cleanup
    // still owns stopAll() on restart/exit.
  }
}
