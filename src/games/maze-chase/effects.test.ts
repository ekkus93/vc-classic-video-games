import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  MAZE_CHASE_AUDIO_IDS,
  MAZE_CHASE_EFFECT_RULES,
  MazeChaseEffects,
} from "./effects.js";

export const tests: readonly TestCase[] = [
  {
    name: "P10-010 Maze Chase events route through shared audio IDs",
    run: () => {
      const audio = new FakeAudioService();
      const effects = new MazeChaseEffects(audio);
      effects.handle([
        { type: "pellet-collected", position: { x: 1, y: 1 }, points: 10 },
        { type: "power-collected", position: { x: 2, y: 2 }, points: 50 },
        { type: "enemy-captured", enemy: "amber", position: { x: 3, y: 3 }, points: 200 },
        { type: "player-hit", livesRemaining: 2, position: { x: 4, y: 4 } },
        { type: "bonus-collected", position: { x: 5, y: 5 }, points: 400 },
        { type: "level-cleared", level: 1, bonus: 600 },
      ]);
      assert(
        audio.playedEffects.join(",") ===
          [
            MAZE_CHASE_AUDIO_IDS.pellet,
            MAZE_CHASE_AUDIO_IDS.power,
            MAZE_CHASE_AUDIO_IDS.capture,
            MAZE_CHASE_AUDIO_IDS.hit,
            MAZE_CHASE_AUDIO_IDS.bonus,
            MAZE_CHASE_AUDIO_IDS.levelClear,
          ].join(","),
        "gameplay sounds must use only the shared audio service",
      );
    },
  },
  {
    name: "P10-010 transient visual effects stay bounded and self-expire",
    run: () => {
      const effects = new MazeChaseEffects(new FakeAudioService());
      for (let index = 0; index < 20; index += 1) {
        effects.handle([
          { type: "player-hit", livesRemaining: 2, position: { x: 10, y: 8 } },
        ]);
      }
      assert(
        effects.particleCount === MAZE_CHASE_EFFECT_RULES.maxParticles,
        "burst spam must cap particles at the authored bound",
      );
      effects.render(new FakeGameRenderer());
      effects.update(1);
      assert(Number(effects.particleCount) === 0, "expired particles must be released");
      effects.destroy();
      assert(Number(effects.particleCount) === 0, "destroy must be idempotent for visual ownership");
    },
  },
];
