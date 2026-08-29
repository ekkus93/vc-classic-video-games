import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  JUNGLE_QUEST_AUDIO_IDS,
  JUNGLE_QUEST_EFFECT_RULES,
  JungleQuestEffects,
} from "./effects.js";

const P = Object.freeze({ x: 120, y: 80 });

export const tests: readonly TestCase[] = [
  {
    name: "P13 effects route one-shots and vine loop through shared audio",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new JungleQuestEffects(audio);
      effects.handle([
        { type: "jumped", position: P },
        { type: "vine-latched", position: P },
        { type: "relic-collected", id: "r", points: 250, position: P },
      ]);
      assert(
        audio.playedEffects.includes(JUNGLE_QUEST_AUDIO_IDS.jump) &&
          audio.playedEffects.includes(JUNGLE_QUEST_AUDIO_IDS.relic),
        "one-shots must use AudioService",
      );
      assert(audio.isActive(JUNGLE_QUEST_AUDIO_IDS.vine), "latched vine must own one loop");
      effects.handle([{ type: "vine-released", position: P }]);
      assert(!audio.isActive(JUNGLE_QUEST_AUDIO_IDS.vine), "release must stop loop");
    },
  },
  {
    name: "P13 visual effects stay bounded and expire",
    run: () => {
      const effects = new JungleQuestEffects(new FakeAudioService());
      for (let i = 0; i < 20; i += 1) {
        effects.handle([{ type: "relic-collected", id: `r${i}`, points: 250, position: P }]);
      }
      assert(
        effects.particleCount === JUNGLE_QUEST_EFFECT_RULES.maxParticles,
        "particles must clamp to cap",
      );
      effects.update(1);
      assert(Number(effects.particleCount) === 0, "particles must expire");
    },
  },
  {
    name: "P13 destroy releases owned audio and particles",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new JungleQuestEffects(audio);
      effects.setVineActive(true);
      effects.handle([{ type: "player-hit", livesRemaining: 2, position: P }]);
      effects.setVineActive(true);
      effects.destroy();
      assert(!audio.isActive(JUNGLE_QUEST_AUDIO_IDS.vine), "destroy must release vine loop");
      assert(effects.particleCount === 0, "destroy must clear particles");
    },
  },
];
