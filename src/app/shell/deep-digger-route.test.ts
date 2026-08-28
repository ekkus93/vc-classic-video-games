import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { DEEP_DIGGER_MODULE } from "../../games/deep-digger/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class DeepDiggerFrameScheduler implements FrameScheduler {
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

async function exitThroughPause(controller: ShellController): Promise<void> {
  await controller.handleCommand("pause");
  for (let index = 0; index < 4; index += 1) {
    await controller.handleCommand("down");
  }
  await controller.handleCommand("activate");
}

export const tests: readonly TestCase[] = [
  {
    name: "P14 controller-only route launches pauses restarts and exits real Deep Digger",
    run: async () => {
      const scheduler = new DeepDiggerFrameScheduler();
      const services = createFakeGameServices(0x1414);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([DEEP_DIGGER_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" && controller.selectedGame?.id === "deep-digger",
        "controller activation must enter the Deep Digger pre-game screen",
      );
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch the real game");
      assert(host.activeGameId === "deep-digger", "real module must own active runtime");
      assert(host.loopRunning, "launch must start the shared fixed-step RAF driver");
      assert(Number(scheduler.pendingCount) === 1, "running game must own exactly one frame callback");

      await controller.handleCommand("pause");
      assert(Boolean(controller.snapshot.gamePaused) && host.simulationPaused, "pause must freeze simulation");
      await controller.handleCommand("down");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "restart must return to a running game");
      assert(Number(scheduler.pendingCount) === 1, "restart must not duplicate the shared RAF chain");

      await exitThroughPause(controller);
      assert(String(controller.snapshot.screen) === "launcher", "exit must recover the launcher");
      assert(host.activeGameId === null, "exit must release active game ownership");
      assert(!host.loopRunning, "exit must stop the shared frame driver");
      assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final frame callback");
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio");
    },
  },
  {
    name: "P14 lifecycle soak repeats real launch restart exit without ownership accumulation",
    run: async () => {
      const scheduler = new DeepDiggerFrameScheduler();
      const services = createFakeGameServices(0x14ff);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([DEEP_DIGGER_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      for (let cycle = 0; cycle < 25; cycle += 1) {
        await controller.handleCommand("activate");
        await controller.handleCommand("activate");
        assert(host.activeGameId === "deep-digger", "soak launch must own one real game instance");
        assert(Number(scheduler.pendingCount) === 1, "soak launch must own exactly one RAF callback");

        await controller.handleCommand("pause");
        await controller.handleCommand("down");
        await controller.handleCommand("activate");
        assert(Number(scheduler.pendingCount) === 1, "soak restart must preserve one RAF callback");

        await exitThroughPause(controller);
        assert(host.activeGameId === null, "soak exit must destroy the game instance");
        assert(Number(scheduler.pendingCount) === 0, "soak exit must release the RAF callback");
        assert(services.audio.activeCount === 0, "soak exit must release audio ownership");
      }
    },
  },
];
