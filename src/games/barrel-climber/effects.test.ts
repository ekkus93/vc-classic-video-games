import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BARREL_CLIMBER_AUDIO_IDS, BARREL_CLIMBER_EFFECT_RULES, BarrelClimberEffects } from "./effects.js";
import type { BarrelClimberSimulationEvent } from "./simulation.js";

const point = Object.freeze({ x: 100, y: 100 });

export const tests: readonly TestCase[] = [
  {
    name: "P16 shared audio routing owns and releases the rolling hazard loop",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new BarrelClimberEffects(audio);
      effects.setRolling(true);
      effects.setRolling(true);
      assert(audio.playedLoops.filter((id) => id === BARREL_CLIMBER_AUDIO_IDS.roll).length === 1, "rolling loop must start exactly once");
      effects.setRolling(false);
      assert(audio.stopped.includes(BARREL_CLIMBER_AUDIO_IDS.roll), "stopping hazard motion must release the loop");
      effects.destroy();
      assert(audio.activeCount === 0, "destroy must leave no game-owned loop active");
    },
  },
  {
    name: "P16 effects map gameplay feedback to original audio and bounded particles",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new BarrelClimberEffects(audio);
      const events: BarrelClimberSimulationEvent[] = [
        { type: "jumped", position: point },
        { type: "hazard-vaulted", hazardId: 1, points: 120, position: point },
        { type: "player-hit", livesRemaining: 2, position: point },
        { type: "stage-cleared", stageIndex: 0, level: 1, bonus: 700, position: point },
      ];
      for (let index = 0; index < 10; index += 1) {
        effects.handle(events);
      }
      assert(audio.playedEffects.includes(BARREL_CLIMBER_AUDIO_IDS.jump), "jump feedback must use shared audio");
      assert(audio.playedEffects.includes(BARREL_CLIMBER_AUDIO_IDS.vault), "vault feedback must use shared audio");
      assert(audio.playedEffects.includes(BARREL_CLIMBER_AUDIO_IDS.hit), "hit feedback must use shared audio");
      assert(audio.playedEffects.includes(BARREL_CLIMBER_AUDIO_IDS.goal), "goal feedback must use shared audio");
      assert(effects.particleCount <= BARREL_CLIMBER_EFFECT_RULES.maxParticles, "visual effects must remain hard bounded");
      effects.update(1);
      assert(effects.particleCount === 0, "expired transient effects must be reclaimed");
    },
  },
];
