import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import { RIVER_HOPPER_AUDIO_IDS } from "./effects.js";
import { RiverHopperGameInstance } from "./module.js";

export const tests: readonly TestCase[] = [
  {
    name: "P9 module consumes one physical direction edge across multiple fixed updates",
    run: () => {
      const services = createFakeGameServices(99);
      const game = new RiverHopperGameInstance(services);
      game.start({ players: 1, difficulty: "channel", seed: 99 });
      services.input.setHeld(1, "up", true);
      game.update(1 / 60);
      game.update(1 / 60);
      game.update(1 / 60);
      assert(
        services.audio.playedEffects.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.hop).length === 1,
        "one input-poll pressed edge must not become duplicate buffered hops",
      );

      services.input.clearEdges();
      services.input.setHeld(1, "up", false);
      game.update(1 / 60);
      game.update(0.06);
      services.input.clearEdges();
      services.input.setHeld(1, "up", true);
      game.update(1 / 60);
      assert(
        services.audio.playedEffects.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.hop).length === 2,
        "release plus fresh press must produce a new hop",
      );
    },
  },
  {
    name: "P9 module pause freezes game-local effects while shared host owns audio suspension",
    run: () => {
      const services = createFakeGameServices();
      const game = new RiverHopperGameInstance(services);
      game.start({ players: 1, difficulty: "brook", seed: 1 });
      services.input.setHeld(1, "up", true);
      game.pause();
      game.update(0.5);
      assert(services.audio.playedEffects.length === 0, "paused module must not consume gameplay input or emit effects");
      game.resume();
      game.update(1 / 60);
      assert(services.audio.playedEffects.includes(RIVER_HOPPER_AUDIO_IDS.hop), "resume must restore gameplay updates");
    },
  },
  {
    name: "P9 module renders headlessly and destroy releases ambient ownership",
    run: () => {
      const services = createFakeGameServices();
      const game = new RiverHopperGameInstance(services);
      game.start({ players: 1, difficulty: "torrent", seed: 7 });
      game.render(new FakeGameRenderer());
      assert(services.audio.isActive(RIVER_HOPPER_AUDIO_IDS.current), "started run must own the current ambience");
      game.destroy();
      assert(!services.audio.isActive(RIVER_HOPPER_AUDIO_IDS.current), "destroy must release game-owned ambience");
    },
  },
  {
    name: "P9 module rejects unsupported player count and difficulty",
    run: () => {
      const services = createFakeGameServices();
      const game = new RiverHopperGameInstance(services);
      let playersRejected = false;
      try {
        game.start({ players: 2, difficulty: "channel", seed: 1 });
      } catch (error) {
        playersRejected = error instanceof Error;
      }
      assert(playersRejected, "River Hopper is single-player only");
      let difficultyRejected = false;
      try {
        game.start({ players: 1, difficulty: "impossible", seed: 1 });
      } catch (error) {
        difficultyRejected = error instanceof Error;
      }
      assert(difficultyRejected, "undeclared difficulty must fail closed");
    },
  },
];
