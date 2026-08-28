import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { BUG_BARRAGE_AUDIO_IDS } from "../../games/bug-barrage/effects.js";
import { BUG_BARRAGE_MODULE } from "../../games/bug-barrage/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class BugRouteFrameScheduler implements FrameScheduler {
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

  public fire(timestampMilliseconds: number): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameCallback]
      | undefined;
    if (entry === undefined) {
      throw new Error("No pending animation frame");
    }
    const [handle, callback] = entry;
    this.callbacks.delete(handle);
    callback(timestampMilliseconds);
  }

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P11 controller-only launcher route drives real Bug Barrage launch restart and exit",
    run: async () => {
      const scheduler = new BugRouteFrameScheduler();
      const services = createFakeGameServices(0xbada11);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([BUG_BARRAGE_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" &&
          controller.selectedGame?.id === "bug-barrage",
        "controller activation must select Bug Barrage without pointer input",
      );
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch");
      assert(host.activeGameId === "bug-barrage", "real Bug Barrage module must own runtime");
      assert(host.loopRunning && scheduler.pendingCount === 1, "launch must own one RAF chain");

      services.input.setHeld(1, "action-1", true);
      scheduler.fire(0);
      scheduler.fire(17);
      assert(
        services.audio.playedEffects.includes(BUG_BARRAGE_AUDIO_IDS.spark),
        "production logical input bridge must reach Bug Barrage Action 1",
      );

      await controller.handleCommand("pause");
      assert(Boolean(controller.snapshot.gamePaused), "controller pause must suspend the game");
      await controller.handleCommand("down");
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "game" && !Boolean(controller.snapshot.gamePaused),
        "pause-menu Restart must create a fresh running Bug Barrage run",
      );
      assert(scheduler.pendingCount === 1, "restart must preserve exactly one RAF successor");
      assert(!services.input.isHeld(1, "action-1"), "restart must clear stale held game input");

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "launcher" && controller.snapshot.selection === null,
        "controller-only exit must restore the launcher",
      );
      assert(host.activeGameId === null && !host.loopRunning, "exit must release game/loop ownership");
      assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final frame callback");
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio active");
    },
  },
];
