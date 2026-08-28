import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
  type GameModule,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { SPACE_ROCKS_METADATA } from "../../games/space-rocks/metadata.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class RecoveryFrameScheduler implements FrameScheduler {
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
    name: "P2/P7 runtime update failure returns real shell to recoverable launcher",
    run: async () => {
      const scheduler = new RecoveryFrameScheduler();
      const services = createFakeGameServices();
      const failure = new Error("injected Space Rocks update failure");
      const failingModule: GameModule = {
        metadata: SPACE_ROCKS_METADATA,
        create: () => ({
          start: () => undefined,
          update: () => {
            throw failure;
          },
          render: () => undefined,
          pause: () => undefined,
          resume: () => undefined,
          reset: () => undefined,
          destroy: () => undefined,
        }),
      };

      let controller: ShellController | null = null;
      const host = new LoopingGameHost(
        () => services,
        (message, error) => {
          controller?.recoverFromGameFailure(message, error);
        },
        scheduler,
      );
      controller = new ShellController({
        registry: new GameRegistry([failingModule]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();
      await controller.handleCommand("activate");
      await controller.handleCommand("activate");
      host.setRenderer(new FakeGameRenderer());

      assert(
        String(controller.snapshot.screen) === "game" && host.loopRunning,
        "fixture must launch the failing game through the real shell host",
      );
      scheduler.fire(0);
      scheduler.fire(17);

      assert(
        String(controller.snapshot.screen) === "launcher",
        "runtime failure must return the user to the launcher",
      );
      assert(
        controller.snapshot.selection === null,
        "failed game selection must be released during recovery",
      );
      assert(
        controller.snapshot.error?.includes("failed during update") === true &&
          controller.snapshot.error.includes(failure.message),
        "launcher must expose a nontechnical runtime failure message with diagnostic cause",
      );
      assert(host.activeGameId === null, "failed runtime must release active ownership");
      assert(!host.loopRunning, "failed runtime must stop the shared frame loop");
      assert(
        Number(scheduler.pendingCount) === 0,
        "failed runtime must not schedule another animation frame",
      );
      assert(
        services.audio.activeCount === 0 && services.audio.stopAllCount >= 1,
        "failed runtime must centrally clean game-owned audio",
      );
    },
  },
];
