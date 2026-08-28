import type { FrameCallback, FrameScheduler } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  type FakeGameServices,
} from "../../engine/testing/fake-services.js";
import { SKY_RIDERS_AUDIO_IDS } from "../../games/sky-riders/effects.js";
import { SKY_RIDERS_MODULE } from "../../games/sky-riders/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LoopingGameHost } from "./looping-game-host.js";

class SkySoakFrameScheduler implements FrameScheduler {
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
    name: "P12-010 Sky Riders lifecycle soak retains one RAF and releases resources",
    run: async () => {
      const scheduler = new SkySoakFrameScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices();
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(SKY_RIDERS_MODULE, {
          players: cycle % 2 === 0 ? 1 : 2,
          difficulty: "squall",
          seed: 0x9000 + cycle,
        });
        host.setRenderer(renderer);

        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each launch must create one service bundle");
        assert(host.activeGameId === "sky-riders", "launch must own Sky Riders");
        assert(host.loopRunning, "launch must start the shared frame driver");
        assert(
          scheduler.pendingCount === 1,
          "each active run must own exactly one pending animation frame",
        );

        services.input.setHeld(1, "action-1", true);
        const base = cycle * 1000;
        scheduler.fire(base);
        scheduler.fire(base + 17);
        assert(
          services.audio.playedEffects.includes(SKY_RIDERS_AUDIO_IDS.flap),
          "real Sky Riders update must route flap audio through shared audio",
        );
        assert(
          scheduler.pendingCount === 1,
          "render/update activity must preserve one RAF successor",
        );

        host.pause();
        assert(host.simulationPaused, "pause must suspend fixed-step simulation");
        assert(
          services.audio.pauseAllCount === 1,
          "pause must suspend shared game audio exactly once",
        );

        host.resume();
        assert(!host.simulationPaused, "resume must reactivate fixed-step simulation");
        assert(
          services.audio.resumeAllCount === 1,
          "resume must reactivate shared game audio exactly once",
        );

        await host.restart();
        assert(host.activeGameId === "sky-riders", "restart must retain game ownership");
        assert(
          scheduler.pendingCount === 1,
          "restart must reset timing without creating a second RAF chain",
        );
        assert(
          services.audio.activeCount === 0,
          "restart must not retain audio from the destroyed run",
        );
        assert(
          services.audio.stopAllCount >= 1,
          "restart must invoke centralized game-owned audio cleanup",
        );

        services.input.setHeld(1, "right", true);
        scheduler.fire(base + 34);
        scheduler.fire(base + 51);
        assert(
          scheduler.pendingCount === 1,
          "restarted gameplay must still own one RAF successor",
        );

        host.exit();
        assert(host.activeGameId === null, "exit must release active game ownership");
        assert(!host.loopRunning, "exit must stop the frame driver");
        assert(
          Number(scheduler.pendingCount) === 0,
          "exit must cancel the final pending animation frame",
        );
        assert(
          services.audio.activeCount === 0,
          "exit must leave no game-owned audio active",
        );
        assert(
          services.audio.stopAllCount >= 2,
          "restart plus exit must clean both run generations",
        );
      }

      assert(
        servicesByLaunch.length === cycles,
        "soak must create exactly one service bundle per fresh launch",
      );
      assert(
        scheduler.maxPendingCount === 1,
        "the complete soak must never retain duplicate RAF callbacks",
      );
    },
  },
];
