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
  {
    name: "CR2-001 the real module submits its terminal score under mode default, not the run difficulty",
    run: () => {
      // Regression coverage at the actual call site: the module used to pass its own run
      // difficulty as the submission's `mode` (this.scoreCommitter.handle(events, this.runDifficulty
      // ?? "default")), which is a different field from the difficulty every submission already
      // carries through PersistentScoreService -- and left every Deep Digger score filed under a
      // mode the launcher's high-score query never reads (it is hard-coded to mode "default"), so
      // no Deep Digger score was ever visible in the launcher regardless of difficulty played.
      // With idle input, an approaching stalker reaches and repeatedly hits the respawning player
      // until lives reach zero, at a fixed seed, well within the frame budget below.
      const services = createFakeGameServices(0x1414);
      const instance = DEEP_DIGGER_MODULE.create(services);
      instance.start({ players: 1, difficulty: "bore", seed: 0x1414 });
      for (let frame = 0; frame < 3000 && services.scores.submissions.length === 0; frame += 1) {
        instance.update(1 / 60);
      }
      assert(services.scores.submissions.length === 1, "fixture premise: idle input must reach exactly one terminal submission");
      assert(services.scores.submissions[0]?.mode === "default", "the module must submit under mode default like every other game, not the run difficulty");
    },
  },
];
