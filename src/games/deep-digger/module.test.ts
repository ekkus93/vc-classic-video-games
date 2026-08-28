import { createFakeGameServices, SeededRandomService } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import { DEEP_DIGGER_AUDIO_IDS } from "./effects.js";
import { DEEP_DIGGER_MODULE, DeepDiggerGameInstance } from "./module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P14 real module consumes shared input audio RNG and renderer services",
    run: () => {
      const services = createFakeGameServices(123);
      const instance = DEEP_DIGGER_MODULE.create(services);
      instance.start({ players: 1, difficulty: "bore", seed: 0x1410 });

      const expected = new SeededRandomService(0x1410).nextUint32();
      assert(
        services.rng.nextUint32() === expected,
        "game start must reset the injected RNG to the run seed",
      );

      services.input.setHeld(1, "left", true);
      instance.update(1 / 60);
      assert(
        services.audio.playedEffects.includes(DEEP_DIGGER_AUDIO_IDS.dig),
        "keyboard/gamepad logical movement must drive digging through shared services",
      );
      services.input.setHeld(1, "action-1", true);
      instance.update(1 / 60);
      assert(
        services.audio.playedEffects.includes(DEEP_DIGGER_AUDIO_IDS.pump),
        "shared Action 1 press must drive the pressure tool",
      );
      instance.render(new FakeGameRenderer());
      instance.destroy();
      assert(services.audio.activeCount === 0, "destroy must not retain game-owned audio");
    },
  },
  {
    name: "P14 pause resume restart and destroy remain safe across repeated lifecycle cycles",
    run: () => {
      const services = createFakeGameServices(0x14aa);
      const instance = new DeepDiggerGameInstance(services);
      for (let cycle = 0; cycle < 40; cycle += 1) {
        instance.start({ players: 1, difficulty: "survey", seed: 100 + cycle });
        instance.update(1 / 60);
        instance.pause();
        instance.update(5);
        instance.resume();
        instance.reset();
        instance.render(new FakeGameRenderer());
        instance.destroy();
        assert(services.audio.activeCount === 0, "lifecycle cycle must not leak audio ownership");
      }
    },
  },
  {
    name: "P14 invalid launch options fail before a run becomes active",
    run: () => {
      const instance = new DeepDiggerGameInstance(createFakeGameServices());
      let playersRejected = false;
      try {
        instance.start({ players: 2, difficulty: "bore", seed: 1 });
      } catch (error) {
        playersRejected = error instanceof Error;
      }
      assert(playersRejected, "unsupported player count must fail closed");

      let difficultyRejected = false;
      try {
        instance.start({ players: 1, difficulty: "unknown", seed: 1 });
      } catch (error) {
        difficultyRejected = error instanceof Error;
      }
      assert(difficultyRejected, "unsupported difficulty must fail closed");
    },
  },
];
