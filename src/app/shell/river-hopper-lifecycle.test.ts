import type { FrameCallback, FrameScheduler } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices, type FakeGameServices } from "../../engine/testing/fake-services.js";
import { RIVER_HOPPER_AUDIO_IDS } from "../../games/river-hopper/effects.js";
import { RIVER_HOPPER_MODULE } from "../../games/river-hopper/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LoopingGameHost } from "./looping-game-host.js";

class SoakScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameCallback>();
  public maxPendingCount = 0;

  public request(callback: FrameCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    this.maxPendingCount = Math.max(this.maxPendingCount, this.callbacks.size);
    return handle;
  }

  public cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  public fire(timestampMilliseconds: number): void {
    const entry = this.callbacks.entries().next().value as [number, FrameCallback] | undefined;
    if (entry === undefined) {
      throw new Error("No pending frame");
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
    name: "P9-010 River Hopper lifecycle soak retains one RAF and releases every run resource",
    run: async () => {
      const scheduler = new SoakScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices();
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(RIVER_HOPPER_MODULE, {
          players: 1,
          difficulty: cycle % 2 === 0 ? "channel" : "brook",
          seed: 0x9000 + cycle,
        });
        host.setRenderer(renderer);
        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each fresh launch must create one service bundle");
        assert(host.activeGameId === "river-hopper", "launch must own River Hopper");
        assert(host.loopRunning && scheduler.pendingCount === 1, "active run must own exactly one frame callback");
        assert(services.audio.isActive(RIVER_HOPPER_AUDIO_IDS.current), "active run must own one ambient loop");

        services.input.setHeld(1, "up", true);
        const base = cycle * 1000;
        scheduler.fire(base);
        scheduler.fire(base + 17);
        assert(services.audio.playedEffects.includes(RIVER_HOPPER_AUDIO_IDS.hop), "real fixed-step update must consume game input");
        assert(scheduler.pendingCount === 1, "update/render must preserve one RAF successor");

        host.pause();
        assert(host.simulationPaused && services.audio.pauseAllCount === 1, "pause must suspend simulation and shared audio");
        host.resume();
        assert(!host.simulationPaused && services.audio.resumeAllCount === 1, "resume must reactivate both");

        await host.restart();
        assert(host.activeGameId === "river-hopper", "restart retains game ownership");
        assert(scheduler.pendingCount === 1, "restart must reset timing without a second RAF");
        assert(services.audio.stopAllCount >= 1, "restart must centrally clean old run audio");
        assert(services.audio.isActive(RIVER_HOPPER_AUDIO_IDS.current), "restarted run must own only its replacement ambience");
        assert(services.input.isHeld(1, "up") === false, "restart must clear stale controller/keyboard state");

        scheduler.fire(base + 34);
        scheduler.fire(base + 51);
        assert(scheduler.pendingCount === 1, "restarted gameplay must remain single-chain");

        host.exit();
        assert(host.activeGameId === null && !host.loopRunning, "exit must release active ownership");
        assert(Number(scheduler.pendingCount) === 0, "exit must cancel the last frame callback");
        assert(services.audio.activeCount === 0, "exit must leave no game-owned audio active");
        assert(services.audio.stopAllCount >= 2, "restart and exit must clean both run generations");
      }

      assert(servicesByLaunch.length === cycles, "soak must create one bundle per fresh launch");
      assert(scheduler.maxPendingCount === 1, "all 40 cycles must remain single-RAF");
    },
  },
];
