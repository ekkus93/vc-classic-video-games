import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BUG_BARRAGE_AUDIO_IDS } from "./effects.js";
import { BUG_BARRAGE_MODULE, BugBarrageGameInstance } from "./module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P11 real module uses production-facing input audio render pause reset and teardown services",
    run: () => {
      const services = createFakeGameServices(0x1111);
      const instance = BUG_BARRAGE_MODULE.create(services);
      assert(instance instanceof BugBarrageGameInstance, "module must create the real game instance");
      instance.start({ players: 1, difficulty: "swarm", seed: 0x1111 });
      services.input.setHeld(1, "action-1", true);
      instance.update(1 / 60);
      assert(
        services.audio.playedEffects.includes(BUG_BARRAGE_AUDIO_IDS.spark),
        "logical Action 1 must route a spark effect through shared audio",
      );
      instance.render(new FakeGameRenderer());
      const effectCount = services.audio.playedEffects.length;
      instance.pause();
      instance.update(1);
      assert(
        services.audio.playedEffects.length === effectCount,
        "paused game instance must not advance gameplay/audio effects",
      );
      instance.resume();
      instance.reset();
      services.input.setHeld(1, "action-1", false);
      instance.update(1 / 60);
      instance.destroy();
      instance.render(new FakeGameRenderer());
    },
  },
  {
    name: "P11 module resolves every bundled asset and rejects unknown paths",
    run: () => {
      const resolve = BUG_BARRAGE_MODULE.resolveAssetUrl;
      assert(resolve !== undefined, "module must expose bundled asset resolution");
      for (const path of [
        "assets.json",
        "audio/spark.wav",
        "audio/segment.wav",
        "audio/pod.wav",
        "audio/hit.wav",
        "audio/wave.wav",
      ]) {
        assert(resolve(path) !== null, `${path} must resolve`);
      }
      assert(resolve("audio/missing.wav") === null, "unknown assets must fail closed");
    },
  },
];
