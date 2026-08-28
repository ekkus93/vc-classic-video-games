import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type GameServices,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { MAZE_CHASE_MODULE } from "../../games/maze-chase/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class MazeRecoveryScheduler implements FrameScheduler {
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

class ThrowingMazeRenderer extends FakeGameRenderer {
  public override clear(): void {
    throw new Error("injected Maze Chase render failure");
  }
}

export const tests: readonly TestCase[] = [

  {
    name: "P10-011 update failure in real Maze Chase returns the shell to a recoverable launcher",
    run: async () => {
      const scheduler = new MazeRecoveryScheduler();
      const base = createFakeGameServices();
      const services: GameServices = {
        ...base,
        input: {
          pointer: base.input.pointer,
          isHeld: (player, action) => base.input.isHeld(player, action),
          wasPressed: () => {
            throw new Error("injected Maze Chase update failure");
          },
          wasReleased: (player, action) => base.input.wasReleased(player, action),
          reset: () => base.input.reset(),
        },
      };
      let controller: ShellController | null = null;
      const host = new LoopingGameHost(
        () => services,
        (message, error) => controller?.recoverFromGameFailure(message, error),
        scheduler,
      );
      controller = new ShellController({
        registry: new GameRegistry([MAZE_CHASE_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();
      await controller.handleCommand("activate");
      await controller.handleCommand("activate");
      host.setRenderer(new FakeGameRenderer());
      assert(String(controller.snapshot.screen) === "game", "fixture must launch the real Maze Chase module");

      scheduler.fire(0);
      scheduler.fire(17);
      assert(String(controller.snapshot.screen) === "launcher", "update failure must return to launcher recovery");
      assert(controller.snapshot.selection === null, "failed game selection must be released");
      assert(
        controller.snapshot.error?.includes("failed during update") === true,
        "recovery state must identify the failing runtime phase",
      );
      assert(host.activeGameId === null && !host.loopRunning, "recovery must release game and loop ownership");
      assert(scheduler.pendingCount === 0, "failed update must not schedule a successor frame");
      assert(base.audio.activeCount === 0 && base.audio.stopAllCount >= 1, "update recovery must centrally clean game audio");
    },
  },
  {
    name: "P10-011 render failure in real Maze Chase returns the shell to a recoverable launcher",
    run: async () => {
      const scheduler = new MazeRecoveryScheduler();
      const services = createFakeGameServices();
      let controller: ShellController | null = null;
      const host = new LoopingGameHost(
        () => services,
        (message, error) => controller?.recoverFromGameFailure(message, error),
        scheduler,
      );
      controller = new ShellController({
        registry: new GameRegistry([MAZE_CHASE_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();
      await controller.handleCommand("activate");
      await controller.handleCommand("activate");
      host.setRenderer(new ThrowingMazeRenderer());
      assert(String(controller.snapshot.screen) === "game", "fixture must launch the real Maze Chase module");

      scheduler.fire(0);
      assert(String(controller.snapshot.screen) === "launcher", "render failure must return to launcher recovery");
      assert(controller.snapshot.selection === null, "failed game selection must be released");
      assert(
        controller.snapshot.error?.includes("failed during render") === true,
        "recovery state must identify the failing runtime phase",
      );
      assert(host.activeGameId === null && !host.loopRunning, "recovery must release game and loop ownership");
      assert(scheduler.pendingCount === 0, "failed frame must not schedule a successor");
      assert(services.audio.activeCount === 0 && services.audio.stopAllCount >= 1, "failure recovery must centrally clean game audio");
    },
  },
];
