import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
  type GameRenderer,
  type GameServices,
  type InputService,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { RIVER_HOPPER_MODULE } from "../../games/river-hopper/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class RecoveryScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameCallback>();
  public request(callback: FrameCallback): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }
  public cancel(handle: number): void {
    this.callbacks.delete(handle);
  }
  public fire(timestampMilliseconds: number): void {
    const entry = this.callbacks.entries().next().value as [number, FrameCallback] | undefined;
    if (entry === undefined) throw new Error("No pending frame");
    const [handle, callback] = entry;
    this.callbacks.delete(handle);
    callback(timestampMilliseconds);
  }
  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

async function launchedController(
  services: GameServices,
  scheduler: RecoveryScheduler,
): Promise<{ controller: ShellController; host: LoopingGameHost }> {
  let controller: ShellController | null = null;
  const host = new LoopingGameHost(
    () => services,
    (message, error) => controller?.recoverFromGameFailure(message, error),
    scheduler,
  );
  controller = new ShellController({
    registry: new GameRegistry([RIVER_HOPPER_MODULE]),
    documents: new MemoryJsonDocumentStore(),
    gameHost: host,
  });
  await controller.initialize();
  await controller.handleCommand("activate");
  await controller.handleCommand("activate");
  return { controller, host };
}

class ThrowingRenderer extends FakeGameRenderer implements GameRenderer {
  public override clear(): void {
    throw new Error("injected River Hopper render failure");
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P9-010 real River Hopper update failure returns shell to recoverable launcher",
    run: async () => {
      const base = createFakeGameServices();
      const failure = new Error("injected River Hopper input failure");
      const brokenInput: InputService = {
        pointer: base.input.pointer,
        isHeld: (player, action) => base.input.isHeld(player, action),
        wasPressed: () => {
          throw failure;
        },
        wasReleased: (player, action) => base.input.wasReleased(player, action),
        reset: () => base.input.reset(),
      };
      const services: GameServices = Object.freeze({ ...base, input: brokenInput });
      const scheduler = new RecoveryScheduler();
      const { controller, host } = await launchedController(services, scheduler);
      host.setRenderer(new FakeGameRenderer());
      scheduler.fire(0);
      scheduler.fire(17);
      assert(controller.snapshot.screen === "launcher", "update failure must recover to launcher");
      assert(controller.snapshot.error?.includes("failed during update") === true, "recovery must identify update phase");
      assert(host.activeGameId === null && !host.loopRunning, "failed runtime must release ownership");
      assert(scheduler.pendingCount === 0, "failed update must not leave a RAF successor");
      assert(base.audio.activeCount === 0 && base.audio.stopAllCount >= 1, "failure cleanup must release River Hopper audio");
    },
  },
  {
    name: "P9-010 real River Hopper render failure returns shell to recoverable launcher",
    run: async () => {
      const services = createFakeGameServices();
      const scheduler = new RecoveryScheduler();
      const { controller, host } = await launchedController(services, scheduler);
      host.setRenderer(new ThrowingRenderer());
      scheduler.fire(0);
      assert(controller.snapshot.screen === "launcher", "render failure must recover to launcher");
      assert(controller.snapshot.error?.includes("failed during render") === true, "recovery must identify render phase");
      assert(host.activeGameId === null && !host.loopRunning, "render failure must release runtime ownership");
      assert(scheduler.pendingCount === 0, "render failure must stop the RAF chain");
      assert(services.audio.activeCount === 0, "render failure must release ambient audio");
    },
  },
];
