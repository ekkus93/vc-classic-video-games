import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  STAR_DEFENDER_AUDIO_IDS,
  STAR_DEFENDER_EFFECT_RULES,
  StarDefenderEffects,
} from "./effects.js";
import type { StarDefenderSimulationEvent } from "./simulation.js";

export const tests: readonly TestCase[] = [
  {
    name: "P15 audio routes engine and event effects through shared ownership",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new StarDefenderEffects(audio);
      effects.setEngine(true);
      effects.setEngine(true);
      assert(
        audio.playedLoops.filter((id) => id === STAR_DEFENDER_AUDIO_IDS.engine).length === 1,
        "one active engine state must own only one loop start",
      );

      const events: readonly StarDefenderSimulationEvent[] = [
        { type: "lance-fired", position: { x: 10, y: 20 } },
        {
          type: "emergency-used",
          position: { x: 20, y: 30 },
          destroyed: 4,
          chargesRemaining: 1,
        },
        { type: "inhabitant-caught", inhabitantId: 1, points: 160 },
        { type: "wave-cleared", wave: 1, bonus: 500, emergencyCharges: 2 },
      ];
      effects.handle(events);
      assert(
        audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.lance) &&
          audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.emergency) &&
          audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.rescue) &&
          audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.wave),
        "gameplay events must use only declared shared-audio IDs",
      );
      effects.destroy();
      assert(
        !audio.isActive(STAR_DEFENDER_AUDIO_IDS.engine),
        "destroy must release the game-owned engine loop",
      );
    },
  },
  {
    name: "P15 transient visual effects remain bounded during burst-heavy play",
    run: () => {
      const effects = new StarDefenderEffects(new FakeAudioService());
      for (let index = 0; index < 20; index += 1) {
        effects.handle([
          {
            type: "emergency-used",
            position: { x: 160, y: 120 },
            destroyed: 24,
            chargesRemaining: 0,
          },
        ]);
      }
      assert(
        effects.particleCount === STAR_DEFENDER_EFFECT_RULES.maxParticles,
        "repeated emergency bursts must clamp at the particle cap",
      );
      effects.update(1);
      assert(Number(effects.particleCount) === 0, "expired particles must be released");
    },
  },
];
