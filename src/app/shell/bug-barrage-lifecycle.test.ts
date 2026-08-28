import type { FrameCallback, FrameScheduler } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  type FakeGameServices,
} from "../../engine/testing/fake-services.js";
import { BUG_BARRAGE_AUDIO_IDS } from "../../games/bug-barrage/effects.js";
import { BUG_BARRAGE_MODULE } from "../../games/bug-barrage/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LoopingGameHost } from "./looping-game-host.js";

class BugCountingFrameScheduler implements FrameScheduler {
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
    name: "P11 lifecycle soak keeps one RAF and releases Bug Barrage run resources",
    run: async () => {
      const scheduler = new BugCountingFrameScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices();
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(BUG_BARRAGE_MODULE, {
          players: 1,
          difficulty: "swarm",
          seed: 0xb000 + cycle,
        });
        host.setRenderer(renderer);
        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each launch must create one service bundle");
        assert(host.activeGameId === "bug-barrage", "launch must own Bug Barrage");
        assert(scheduler.pendingCount === 1, "each run must own one pending frame callback");

        services.input.setHeld(1, "action-1", true);
        const base = cycle * 1000;
        scheduler.fire(base);
        scheduler.fire(base + 17);
        assert(
          services.audio.playedEffects.includes(BUG_BARRAGE_AUDIO_IDS.spark),
          "real update must route spark audio through shared services",
        );
        assert(scheduler.pendingCount === 1, "update/render must preserve one RAF successor");

        host.pause();
        assert(host.simulationPaused, "pause must suspend fixed-step simulation");
        assert(services.audio.pauseAllCount === 1, "pause must suspend shared audio once");
        host.resume();
        assert(!host.simulationPaused, "resume must reactivate simulation");
        assert(services.audio.resumeAllCount === 1, "resume must reactivate shared audio once");

        await host.restart();
        assert(host.activeGameId === "bug-barrage", "restart must retain game ownership");
        assert(scheduler.pendingCount === 1, "restart must not create a second RAF chain");
        assert(!services.input.isHeld(1, "action-1"), "restart must clear stale held input");
        assert(services.audio.activeCount === 0, "restart must release old-run audio ownership");
        assert(services.audio.stopAllCount >= 1, "restart must invoke centralized audio cleanup");

        scheduler.fire(base + 34);
        scheduler.fire(base + 51);
        assert(scheduler.pendingCount === 1, "fresh run must continue on one RAF successor");

        host.exit();
        assert(host.activeGameId === null && !host.loopRunning, "exit must release host ownership");
        assert(Number(scheduler.pendingCount) === 0, "exit must cancel the pending frame");
        assert(services.audio.activeCount === 0, "exit must leave no active game audio");
        assert(services.audio.stopAllCount >= 2, "restart plus exit must clean both run generations");
      }

      assert(servicesByLaunch.length === cycles, "soak must create one bundle per fresh launch");
      assert(scheduler.maxPendingCount === 1, "soak must never retain duplicate RAF callbacks");
    },
  },
];
