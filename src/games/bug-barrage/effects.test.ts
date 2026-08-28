import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_LIMITS } from "./design.js";
import { BUG_BARRAGE_AUDIO_IDS, BugBarrageEffects } from "./effects.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11 original effects route through shared audio and remain bounded",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new BugBarrageEffects(audio);
      for (let index = 0; index < 100; index += 1) {
        effects.handle([
          {
            type: "segment-destroyed",
            position: { x: 100, y: 100 },
            points: 40,
            chainCount: 2,
          },
        ]);
      }
      assert(
        audio.playedEffects.includes(BUG_BARRAGE_AUDIO_IDS.segment),
        "segment effect must use the shared audio service",
      );
      assert(
        effects.particleCount === BUG_BARRAGE_LIMITS.maxEffects,
        "transient effects must stop exactly at the hard cap",
      );
      effects.update(1);
      assert(Number(effects.particleCount) === 0, "expired effects must be released");
      effects.destroy();
      assert(Number(effects.particleCount) === 0, "destroy must release all game effects");
    },
  },
];
