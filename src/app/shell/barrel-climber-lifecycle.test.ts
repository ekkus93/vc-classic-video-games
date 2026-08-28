import type { FrameCallback, FrameScheduler } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  type FakeGameServices,
} from "../../engine/testing/fake-services.js";
import { BARREL_CLIMBER_AUDIO_IDS } from "../../games/barrel-climber/effects.js";
import { BARREL_CLIMBER_MODULE } from "../../games/barrel-climber/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LoopingGameHost } from "./looping-game-host.js";

class BarrelCountingFrameScheduler implements FrameScheduler {
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
    name: "P16 lifecycle soak retains one RAF and releases Barrel Climber run resources",
    run: async () => {
      const scheduler = new BarrelCountingFrameScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices();
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(BARREL_CLIMBER_MODULE, {
          players: 1,
          difficulty: "shift",
          seed: 0x1600 + cycle,
        });
        host.setRenderer(renderer);
        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each launch must create one service bundle");
        assert(host.activeGameId === "barrel-climber" && host.loopRunning, "launch must own Barrel Climber and the shared loop");
        assert(scheduler.pendingCount === 1, "active run must own exactly one pending animation frame");

        const base = cycle * 1000;
        scheduler.fire(base);
        scheduler.fire(base + 17);
        assert(services.audio.playedLoops.includes(BARREL_CLIMBER_AUDIO_IDS.roll), "real update must route hazard rolling through shared audio");
        assert(scheduler.pendingCount === 1, "update/render must preserve one RAF successor");

        host.pause();
        assert(host.simulationPaused, "pause must freeze fixed-step simulation");
        assert(services.audio.pauseAllCount === 1, "pause must suspend shared audio exactly once");
        assert(!services.audio.isActive(BARREL_CLIMBER_AUDIO_IDS.roll), "game pause must release its owned rolling loop");

        host.resume();
        assert(!host.simulationPaused, "resume must reactivate simulation");
        assert(services.audio.resumeAllCount === 1, "resume must reactivate shared audio exactly once");

        await host.restart();
        assert(host.activeGameId === "barrel-climber", "restart must retain game ownership");
        assert(scheduler.pendingCount === 1, "restart must not create a second RAF chain");
        assert(services.audio.activeCount === 0 && services.audio.stopAllCount >= 1, "restart must centrally clean prior-run audio");

        host.exit();
        assert(host.activeGameId === null && !host.loopRunning, "exit must release active game and frame loop");
        assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final pending frame");
        assert(services.audio.activeCount === 0 && services.audio.stopAllCount >= 2, "exit must leave no audio ownership");
      }

      assert(servicesByLaunch.length === cycles, "soak must create one service bundle per fresh launch");
      assert(scheduler.maxPendingCount === 1, "complete soak must never retain duplicate RAF callbacks");
    },
  },
];
