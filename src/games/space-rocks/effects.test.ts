import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  SPACE_ROCKS_AUDIO_IDS,
  SPACE_ROCKS_EFFECT_RULES,
  SpaceRocksEffects,
} from "./effects.js";
import type { SpaceRocksSimulationEvent } from "./simulation.js";

const ORIGIN = Object.freeze({ x: 120, y: 80 });

export const tests: readonly TestCase[] = [
  {
    name: "P7-008 effects route gameplay audio through the shared AudioService",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new SpaceRocksEffects(audio);
      const events: readonly SpaceRocksSimulationEvent[] = [
        { type: "pulse-fired", position: ORIGIN },
        { type: "rock-fractured", size: "medium", points: 90, position: ORIGIN },
        { type: "ship-hit", livesRemaining: 2, position: ORIGIN },
        { type: "wave-cleared", wave: 1, bonus: 300 },
      ];

      effects.setThrust(true);
      effects.setThrust(true);
      effects.handle(events);
      effects.setThrust(false);

      assert(
        audio.playedLoops.length === 1 &&
          audio.playedLoops[0] === SPACE_ROCKS_AUDIO_IDS.thrust,
        "thrust must own exactly one shared-service loop while held",
      );
      assert(
        audio.stopped.includes(SPACE_ROCKS_AUDIO_IDS.thrust),
        "releasing thrust must stop the owned loop through AudioService",
      );
      assert(
        audio.playedEffects.join(",") ===
          [
            SPACE_ROCKS_AUDIO_IDS.pulse,
            SPACE_ROCKS_AUDIO_IDS.fracture,
            SPACE_ROCKS_AUDIO_IDS.hullHit,
            SPACE_ROCKS_AUDIO_IDS.waveClear,
          ].join(","),
        "simulation events must map to project-owned shared-service effect IDs",
      );
    },
  },
  {
    name: "P7-008 visual effects remain hard-bounded and expire deterministically",
    run: () => {
      const effects = new SpaceRocksEffects(new FakeAudioService());
      const burst: SpaceRocksSimulationEvent = {
        type: "rock-fractured",
        size: "large",
        points: 35,
        position: ORIGIN,
      };

      for (let index = 0; index < 20; index += 1) {
        effects.handle([burst]);
      }
      assert(
        effects.particleCount === SPACE_ROCKS_EFFECT_RULES.maxParticles,
        "repeated bursts must clamp at the fixed particle cap",
      );

      effects.update(1);
      assert(effects.particleCount === 0, "expired geometric particles must be released");
    },
  },
  {
    name: "P7-008 destroy releases game-owned loop and visual effect state",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new SpaceRocksEffects(audio);
      effects.setThrust(true);
      effects.handle([{ type: "ship-hit", livesRemaining: 2, position: ORIGIN }]);
      assert(effects.particleCount > 0, "fixture must create visual effect state");

      effects.destroy();

      assert(effects.particleCount === 0, "destroy must release all visual effect entities");
      assert(
        audio.stopped.filter((id) => id === SPACE_ROCKS_AUDIO_IDS.thrust).length === 1,
        "destroy must stop the game-owned thrust loop exactly once",
      );
      effects.destroy();
      assert(
        audio.stopped.filter((id) => id === SPACE_ROCKS_AUDIO_IDS.thrust).length === 1,
        "repeated destroy must remain idempotent",
      );
    },
  },
];
