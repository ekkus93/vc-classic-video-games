import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { STAR_DEFENDER_AUDIO_IDS } from "./effects.js";
import { STAR_DEFENDER_MODULE, StarDefenderGameInstance } from "./module.js";

function throws(action: () => void): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P15 real module consumes shared logical movement weapon and emergency input",
    run: () => {
      const services = createFakeGameServices(0x1501);
      const instance = new StarDefenderGameInstance(services);
      instance.start({ players: 1, difficulty: "frontier", seed: 0x1501 });
      services.input.setHeld(1, "right", true);
      services.input.setHeld(1, "up", true);
      services.input.setHeld(1, "action-1", true);
      services.input.setHeld(1, "action-2", true);
      instance.update(1 / 60);
      instance.render(new FakeGameRenderer());

      assert(
        services.audio.playedLoops.includes(STAR_DEFENDER_AUDIO_IDS.engine),
        "directional logical input must activate the shared engine loop",
      );
      assert(
        services.audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.lance),
        "Action 1 must route the forward weapon through shared audio",
      );
      assert(
        services.audio.playedEffects.includes(STAR_DEFENDER_AUDIO_IDS.emergency),
        "Action 2 must route the emergency action through shared audio",
      );

      instance.pause();
      assert(
        !services.audio.isActive(STAR_DEFENDER_AUDIO_IDS.engine),
        "pause must release game-owned looping audio",
      );
      instance.destroy();
    },
  },
  {
    name: "P15 module validates launch options and resolves only owned assets",
    run: () => {
      const services = createFakeGameServices();
      const instance = new StarDefenderGameInstance(services);
      assert(
        throws(() => instance.start({ players: 2, difficulty: "frontier", seed: 1 })),
        "unsupported player count must fail at game boundary",
      );
      assert(
        throws(() => instance.start({ players: 1, difficulty: "unknown", seed: 1 })),
        "unsupported difficulty must fail at game boundary",
      );
      assert(
        STAR_DEFENDER_MODULE.resolveAssetUrl?.("assets.json")?.includes("assets.json") === true,
        "module must resolve its own manifest",
      );
      assert(
        STAR_DEFENDER_MODULE.resolveAssetUrl?.("../space-rocks/assets.json") === null,
        "module must not resolve assets outside its ownership boundary",
      );
    },
  },
];
