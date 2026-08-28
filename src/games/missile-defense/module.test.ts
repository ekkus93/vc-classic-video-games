import { ActiveGameRuntime } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { createGameRegistry } from "../registry.js";
import { MISSILE_DEFENSE_AUDIO_IDS } from "./effects.js";
import { MISSILE_DEFENSE_MODULE, MissileDefenseGameInstance } from "./module.js";

class FailingRenderer extends FakeGameRenderer {
  public override clear(): void {
    throw new Error("injected P8 render failure");
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P8-010 canonical launcher registry includes Missile Defense as a Space Rocks peer",
    run: () => {
      const metadata = createGameRegistry().listMetadata();
      assert(metadata.some((entry) => entry.id === "space-rocks"), "reference game must remain registered");
      assert(metadata.some((entry) => entry.id === "missile-defense"), "P8 game must be registered");
      assert(
        MISSILE_DEFENSE_MODULE.resolveAssetUrl?.("assets.json")?.includes("missile-defense/assets.json") === true,
        "production module must resolve its bundled manifest",
      );
    },
  },
  {
    name: "P8-009/P8-010 real module accepts controller and pointer fire through shared services and renders headlessly",
    run: async () => {
      const services = createFakeGameServices(0x8080);
      const game = new MissileDefenseGameInstance(services);
      game.start({ players: 1, difficulty: "guard", seed: 0x8080 });
      services.input.setHeld(1, "right", true);
      services.input.setHeld(1, "action-1", true);
      game.update(1 / 60);
      assert(
        services.audio.playedEffects.includes(MISSILE_DEFENSE_AUDIO_IDS.launch),
        "logical Action 1 must launch through shared audio",
      );
      game.update(1 / 60);
      assert(
        services.audio.playedEffects.filter((id) => id === MISSILE_DEFENSE_AUDIO_IDS.launch).length === 1,
        "one physical press must not duplicate fire across fixed updates in the same input frame",
      );
      services.input.clearEdges();
      services.input.setHeld(1, "action-1", false);
      services.input.pointer.set({
        position: { x: 90, y: 70 },
        inside: true,
        primaryHeld: true,
        primaryPressed: true,
        primaryReleased: false,
      });
      game.update(1 / 60);
      assert(
        services.audio.playedEffects.filter((id) => id === MISSILE_DEFENSE_AUDIO_IDS.launch).length === 2,
        "shared logical pointer press must fire without DOM access",
      );
      game.render(new FakeGameRenderer());
      game.pause();
      game.update(1);
      game.resume();
      game.destroy();

      const renderFailureServices = createFakeGameServices(0x8081);
      const renderRuntime = new ActiveGameRuntime(renderFailureServices);
      await renderRuntime.load(MISSILE_DEFENSE_MODULE);
      await renderRuntime.start({ players: 1, difficulty: "guard", seed: 0x8081 });
      renderRuntime.render(new FailingRenderer());
      assert(renderRuntime.state === "error", "P8 render failures must enter the recoverable runtime error state");
      assert(
        renderFailureServices.audio.stopAllCount >= 1,
        "P8 render failure must centrally release game-owned audio",
      );

      const updateFailureServices = createFakeGameServices(0x8082);
      const updateRuntime = new ActiveGameRuntime(updateFailureServices);
      await updateRuntime.load(MISSILE_DEFENSE_MODULE);
      await updateRuntime.start({ players: 1, difficulty: "guard", seed: 0x8082 });
      updateRuntime.update(-1);
      assert(updateRuntime.state === "error", "P8 update failures must enter the recoverable runtime error state");
      assert(
        updateFailureServices.audio.stopAllCount >= 1,
        "P8 update failure must centrally release game-owned audio",
      );
    },
  },
];
