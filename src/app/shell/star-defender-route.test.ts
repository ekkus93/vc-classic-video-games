import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { STAR_DEFENDER_MODULE } from "../../games/star-defender/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class RouteFrameScheduler implements FrameScheduler {
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
    name: "P15 controller-only route drives real Star Defender launch restart and exit",
    run: async () => {
      const scheduler = new RouteFrameScheduler();
      const services = createFakeGameServices(0x707);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([STAR_DEFENDER_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      assert(
        controller.snapshot.screen === "launcher" && controller.games.length === 1,
        "fixture must begin on the one-game canonical launcher",
      );
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" &&
          controller.selectedGame?.id === "star-defender",
        "controller-only activation must enter the Star Defender pre-game screen",
      );

      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "game",
        "pre-game activation must launch",
      );
      assert(host.activeGameId === "star-defender", "real module must own the active runtime");
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
        "Restart must create a fresh running Star Defender run",
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
      assert(host.activeGameId === null, "exit must release Star Defender ownership");
      assert(!host.loopRunning, "exit must stop the shared frame driver");
      assert(
        Number(scheduler.pendingCount) === 0,
        "exit must cancel the final frame callback",
      );
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio");
    },
  },
];
