import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
  type LogicalAction,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  FakeInputService,
} from "../../engine/testing/fake-services.js";
import { STAR_DEFENDER_MODULE } from "../../games/star-defender/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import type { GameServicesFactory } from "./game-host.js";
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

class FailingInputService extends FakeInputService {
  public fail = false;

  public override isHeld(player: number, action: LogicalAction): boolean {
    if (this.fail) {
      throw new Error("injected Star Defender input failure");
    }
    return super.isHeld(player, action);
  }
}

class FailingRenderer extends FakeGameRenderer {
  public override clear(): void {
    throw new Error("injected Star Defender renderer failure");
  }
}

async function launchWithRecovery(
  scheduler: RecoveryFrameScheduler,
  createServices: GameServicesFactory,
): Promise<{ readonly controller: ShellController; readonly host: LoopingGameHost }> {
  let controller: ShellController | null = null;
  const host = new LoopingGameHost(
    createServices,
    (message, error) => {
      controller?.recoverFromGameFailure(message, error);
    },
    scheduler,
  );
  controller = new ShellController({
    registry: new GameRegistry([STAR_DEFENDER_MODULE]),
    documents: new MemoryJsonDocumentStore(),
    gameHost: host,
  });
  await controller.initialize();
  await controller.handleCommand("activate");
  await controller.handleCommand("activate");
  return { controller, host };
}

export const tests: readonly TestCase[] = [
  {
    name: "P15 real-module update failure returns the shell to a recoverable launcher",
    run: async () => {
      const scheduler = new RecoveryFrameScheduler();
      const services = createFakeGameServices();
      const input = new FailingInputService();
      const { controller, host } = await launchWithRecovery(scheduler, () => ({
        ...services,
        input,
      }));
      host.setRenderer(new FakeGameRenderer());

      scheduler.fire(0);
      input.fail = true;
      scheduler.fire(17);

      assert(
        String(controller.snapshot.screen) === "launcher",
        "update failure must recover to the launcher",
      );
      assert(
        controller.snapshot.error?.includes("failed during update") === true &&
          controller.snapshot.error.includes("injected Star Defender input failure"),
        "launcher must report the Star Defender update failure cause",
      );
      assert(host.activeGameId === null, "failed update must release game ownership");
      assert(!host.loopRunning, "failed update must stop the fixed-step frame loop");
      assert(
        Number(scheduler.pendingCount) === 0,
        "failed update must leave no pending animation frame",
      );
      assert(
        services.audio.activeCount === 0 && services.audio.stopAllCount >= 1,
        "failed update must centrally release game-owned audio",
      );
    },
  },
  {
    name: "P15 real-module render failure returns the shell to a recoverable launcher",
    run: async () => {
      const scheduler = new RecoveryFrameScheduler();
      const services = createFakeGameServices();
      const { controller, host } = await launchWithRecovery(
        scheduler,
        () => services,
      );
      host.setRenderer(new FailingRenderer());

      scheduler.fire(0);

      assert(
        String(controller.snapshot.screen) === "launcher",
        "render failure must recover to the launcher",
      );
      assert(
        controller.snapshot.error?.includes("failed during render") === true &&
          controller.snapshot.error.includes("injected Star Defender renderer failure"),
        "launcher must report the Star Defender render failure cause",
      );
      assert(host.activeGameId === null, "failed render must release game ownership");
      assert(!host.loopRunning, "failed render must stop the fixed-step frame loop");
      assert(
        Number(scheduler.pendingCount) === 0,
        "failed render must leave no pending animation frame",
      );
      assert(
        services.audio.activeCount === 0 && services.audio.stopAllCount >= 1,
        "failed render must centrally release game-owned audio",
      );
    },
  },
];
