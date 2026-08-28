import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  DEEP_DIGGER_AUDIO_IDS,
  DEEP_DIGGER_EFFECT_RULES,
  DeepDiggerEffects,
} from "./effects.js";
import type { DeepDiggerSimulationEvent } from "./simulation.js";

export const tests: readonly TestCase[] = [
  {
    name: "P14 effects route original game audio only through the shared AudioService",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new DeepDiggerEffects(audio);
      const events: readonly DeepDiggerSimulationEvent[] = [
        { type: "dug", cell: { column: 1, row: 1 }, points: 2 },
        { type: "pump-fired", from: { column: 1, row: 1 }, to: { column: 3, row: 1 } },
        { type: "enemy-defeated", enemyId: 1, points: 250, cell: { column: 3, row: 1 } },
        { type: "rock-loosened", rockId: 1, cell: { column: 5, row: 4 } },
        { type: "player-hit", livesRemaining: 2, cell: { column: 1, row: 1 } },
        { type: "wave-cleared", wave: 1, bonus: 400 },
      ];
      effects.handle(events);
      assert(
        audio.playedEffects.join(",") ===
          [
            DEEP_DIGGER_AUDIO_IDS.dig,
            DEEP_DIGGER_AUDIO_IDS.pump,
            DEEP_DIGGER_AUDIO_IDS.defeat,
            DEEP_DIGGER_AUDIO_IDS.rock,
            DEEP_DIGGER_AUDIO_IDS.hit,
            DEEP_DIGGER_AUDIO_IDS.wave,
          ].join(","),
        "game effects must use manifest asset IDs through the shared audio boundary",
      );
      effects.render(new FakeGameRenderer());
    },
  },
  {
    name: "P14 transient particles stay hard bounded and destroy releases all effect state",
    run: () => {
      const effects = new DeepDiggerEffects(new FakeAudioService());
      for (let index = 0; index < 20; index += 1) {
        effects.handle([
          {
            type: "enemy-defeated",
            enemyId: index,
            points: 250,
            cell: { column: 2, row: 2 },
          },
        ]);
      }
      assert(
        effects.particleCount <= DEEP_DIGGER_EFFECT_RULES.maxParticles,
        "particle effects must never exceed the game-owned bound",
      );
      effects.update(1);
      assert(effects.particleCount === 0, "expired particles must be reclaimed");
      effects.handle([
        { type: "dug", cell: { column: 1, row: 1 }, points: 2 },
      ]);
      effects.destroy();
      assert(effects.particleCount === 0, "destroy must release all transient effect state");
    },
  },
];
