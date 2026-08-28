import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  RIVER_HOPPER_AUDIO_IDS,
  RIVER_HOPPER_EFFECT_RULES,
  RiverHopperEffects,
} from "./effects.js";
import type { RiverHopperSimulationEvent } from "./simulation.js";

const POSITION = Object.freeze({ x: 100, y: 100 });

export const tests: readonly TestCase[] = [
  {
    name: "P9 audio routes through the shared AudioService with one owned current loop",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new RiverHopperEffects(audio);
      effects.startCurrent();
      effects.startCurrent();
      const events: readonly RiverHopperSimulationEvent[] = [
        { type: "hop-started", direction: "up" },
        { type: "life-lost", reason: "vehicle", livesRemaining: 3, position: POSITION },
        { type: "life-lost", reason: "water", livesRemaining: 2, position: POSITION },
        { type: "goal-filled", slotIndex: 1, points: 300, timeBonus: 40 },
        { type: "round-cleared", round: 1, bonus: 900, nextRound: 2, nextStageId: "lantern-reach" },
      ];
      effects.handle(events);
      assert(
        audio.playedLoops.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.current).length === 1,
        "ambient current must not duplicate its loop",
      );
      assert(
        audio.playedEffects.join(",") ===
          [
            RIVER_HOPPER_AUDIO_IDS.hop,
            RIVER_HOPPER_AUDIO_IDS.impact,
            RIVER_HOPPER_AUDIO_IDS.splash,
            RIVER_HOPPER_AUDIO_IDS.goal,
            RIVER_HOPPER_AUDIO_IDS.round,
          ].join(","),
        "game events must map to project-owned shared-service audio IDs",
      );
    },
  },
  {
    name: "P9 visual effects are hard-bounded and expire deterministically",
    run: () => {
      const effects = new RiverHopperEffects(new FakeAudioService());
      const event: RiverHopperSimulationEvent = {
        type: "life-lost",
        reason: "water",
        livesRemaining: 3,
        position: POSITION,
      };
      for (let index = 0; index < 20; index += 1) {
        effects.handle([event]);
      }
      assert(effects.particleCount === RIVER_HOPPER_EFFECT_RULES.maxParticles, "bursts must clamp at the fixed cap");
      effects.update(1);
      assert(Number(effects.particleCount) === 0, "expired particles must be released");
    },
  },
  {
    name: "P9 destroy releases owned audio and visual effect state idempotently",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new RiverHopperEffects(audio);
      effects.startCurrent();
      effects.handle([{ type: "life-lost", reason: "vehicle", livesRemaining: 3, position: POSITION }]);
      effects.destroy();
      assert(effects.particleCount === 0, "destroy must release visual effects");
      assert(audio.stopped.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.current).length === 1, "destroy stops owned current loop exactly once");
      effects.destroy();
      assert(audio.stopped.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.current).length === 1, "repeated destroy remains idempotent");
    },
  },
];
