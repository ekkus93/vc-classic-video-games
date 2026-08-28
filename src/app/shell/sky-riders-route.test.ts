import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { SKY_RIDERS_MODULE } from "../../games/sky-riders/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class SkyRouteFrameScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameCallback>();

  public request(callback: FrameCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  public cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P12-010 controller-only route drives real Sky Riders launch pause restart and exit",
    run: async () => {
      const scheduler = new SkyRouteFrameScheduler();
      const services = createFakeGameServices(0x1210);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([SKY_RIDERS_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      assert(
        controller.snapshot.screen === "launcher" && controller.games.length === 1,
        "fixture must begin on the one-game launcher",
      );
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" &&
          controller.selectedGame?.id === "sky-riders",
        "controller-only activation must enter the Sky Riders pre-game screen",
      );

      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "game",
        "pre-game activation must launch",
      );
      assert(host.activeGameId === "sky-riders", "real module must own the active runtime");
      assert(host.loopRunning, "real launch must start the shared fixed-step RAF driver");
      assert(
        scheduler.pendingCount === 1,
        "real launched game must own exactly one frame callback",
      );

      await controller.handleCommand("pause");
      assert(
        Boolean(controller.snapshot.gamePaused) && host.simulationPaused,
        "controller pause must freeze the real game runtime",
      );
      await controller.handleCommand("down");
      assert(
        Number(controller.snapshot.pauseFocusIndex) === 1,
        "controller navigation must focus Restart without pointer input",
      );
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "game" &&
          !Boolean(controller.snapshot.gamePaused),
        "Restart must create a fresh running Sky Riders run",
      );
      assert(
        scheduler.pendingCount === 1,
        "restart must preserve exactly one shared frame callback",
      );

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      assert(
        Number(controller.snapshot.pauseFocusIndex) === 4,
        "controller navigation must reach Return to launcher",
      );
      await controller.handleCommand("activate");

      assert(
        String(controller.snapshot.screen) === "launcher" &&
          controller.snapshot.selection === null,
        "controller-only exit must restore the launcher",
      );
      assert(host.activeGameId === null, "exit must release Sky Riders ownership");
      assert(!host.loopRunning, "exit must stop the shared frame driver");
      assert(
        Number(scheduler.pendingCount) === 0,
        "exit must cancel the final frame callback",
      );
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio");
    },
  },
];
