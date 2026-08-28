import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
  type GameModule,
  type GameRenderer,
  type GameServices,
  type GameStartOptions,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { BUG_BARRAGE_MODULE } from "../../games/bug-barrage/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class BugRecoveryScheduler implements FrameScheduler {
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
    name: "P11 injected real-game update failure returns shell to a clean launcher",
    run: async () => {
      const scheduler = new BugRecoveryScheduler();
      const services = createFakeGameServices();
      services.input.setHeld(1, "action-1", true);
      const failure = new Error("injected Bug Barrage update failure");
      const failingModule: GameModule = Object.freeze({
        ...BUG_BARRAGE_MODULE,
        create: (gameServices: GameServices) => {
          const real = BUG_BARRAGE_MODULE.create(gameServices);
          return {
            start: (options: GameStartOptions) => real.start(options),
            update: (dtSeconds: number) => {
              real.update(dtSeconds);
              throw failure;
            },
            render: (renderer: GameRenderer) => real.render(renderer),
            pause: () => real.pause(),
            resume: () => real.resume(),
            reset: () => real.reset(),
            destroy: () => real.destroy(),
          };
        },
      });

      let controller: ShellController | null = null;
      const host = new LoopingGameHost(
        () => services,
        (message, error) => controller?.recoverFromGameFailure(message, error),
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

      scheduler.fire(0);
      scheduler.fire(17);
      assert(String(controller.snapshot.screen) === "launcher", "failure must recover to launcher");
      assert(controller.snapshot.selection === null, "failed game selection must be released");
      assert(
        controller.snapshot.error?.includes("failed during update") === true &&
          controller.snapshot.error.includes(failure.message),
        "recovery must surface phase and diagnostic cause",
      );
      assert(host.activeGameId === null && !host.loopRunning, "failed runtime must release ownership");
      assert(Number(scheduler.pendingCount) === 0, "failed runtime must not retain a RAF callback");
      assert(
        services.audio.activeCount === 0 && services.audio.stopAllCount >= 1,
        "failed runtime must centrally clean real Bug Barrage audio",
      );
    },
  },
];
