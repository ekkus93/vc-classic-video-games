import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BARREL_CLIMBER_AUDIO_IDS } from "./effects.js";
import { BarrelClimberGameInstance } from "./module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P16 production module maps logical jump input into simulation/audio and renders through shared renderer",
    run: () => {
      const services = createFakeGameServices(0x1601);
      const game = new BarrelClimberGameInstance(services);
      game.start({ players: 1, difficulty: "shift", seed: 0x1601 });
      services.input.setHeld(1, "action-1", true);
      game.update(1 / 60);
      assert(services.audio.playedEffects.includes(BARREL_CLIMBER_AUDIO_IDS.jump), "logical Action 1 press must produce the jump feedback path");
      game.render(new FakeGameRenderer());
      game.pause();
      assert(services.audio.stopped.includes(BARREL_CLIMBER_AUDIO_IDS.roll), "pause must release the game-owned rolling loop");
      game.resume();
      game.reset();
      assert(
        !services.audio.isActive(BARREL_CLIMBER_AUDIO_IDS.roll),
        "direct reset must not retain the game-owned rolling loop",
      );
      game.destroy();
      assert(
        !services.audio.isActive(BARREL_CLIMBER_AUDIO_IDS.roll),
        "destroy must leave no game-owned rolling loop",
      );
    },
  },
  {
    name: "P16 module rejects unsupported players and difficulty before gameplay",
    run: () => {
      const services = createFakeGameServices();
      const game = new BarrelClimberGameInstance(services);
      let playerError = false;
      try { game.start({ players: 2, difficulty: "shift", seed: 1 }); } catch { playerError = true; }
      assert(playerError, "unsupported player count must fail predictably");
      let difficultyError = false;
      try { game.start({ players: 1, difficulty: "impossible", seed: 1 }); } catch { difficultyError = true; }
      assert(difficultyError, "unknown difficulty must fail predictably");
    },
  },
];
