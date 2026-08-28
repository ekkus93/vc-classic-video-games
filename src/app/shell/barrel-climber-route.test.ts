import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { BARREL_CLIMBER_MODULE } from "../../games/barrel-climber/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class BarrelRouteFrameScheduler implements FrameScheduler {
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
    name: "P16 controller-only route drives real Barrel Climber launch pause restart and exit",
    run: async () => {
      const scheduler = new BarrelRouteFrameScheduler();
      const services = createFakeGameServices(0x1616);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([BARREL_CLIMBER_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      assert(controller.snapshot.screen === "launcher" && controller.games.length === 1, "fixture must begin on the one-game Barrel Climber launcher");
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" && controller.selectedGame?.id === "barrel-climber",
        "controller activation must enter the Barrel Climber pre-game screen",
      );
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch the real module");
      assert(host.activeGameId === "barrel-climber" && host.loopRunning, "real module must own the active shared runtime");
      assert(scheduler.pendingCount === 1, "active game must own exactly one frame callback");

      await controller.handleCommand("pause");
      assert(Boolean(controller.snapshot.gamePaused) && host.simulationPaused, "controller pause must freeze Barrel Climber");
      await controller.handleCommand("down");
      assert(Number(controller.snapshot.pauseFocusIndex) === 1, "controller navigation must focus Restart");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game" && !Boolean(controller.snapshot.gamePaused), "Restart must create a fresh running run");
      assert(scheduler.pendingCount === 1, "restart must retain exactly one frame callback");

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      assert(Number(controller.snapshot.pauseFocusIndex) === 4, "controller navigation must reach Return to launcher");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "launcher" && controller.snapshot.selection === null, "controller exit must restore the launcher");
      assert(host.activeGameId === null && !host.loopRunning, "exit must release game and frame-loop ownership");
      assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final frame callback");
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio");
    },
  },
];
