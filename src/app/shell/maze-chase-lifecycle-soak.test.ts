import type { FrameCallback, FrameScheduler } from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  type FakeGameServices,
} from "../../engine/testing/fake-services.js";
import { MAZE_CHASE_AUDIO_IDS } from "../../games/maze-chase/effects.js";
import { MAZE_CHASE_MODULE } from "../../games/maze-chase/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LoopingGameHost } from "./looping-game-host.js";

class MazeSoakScheduler implements FrameScheduler {
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
    name: "P10-011 Maze Chase lifecycle soak retains one RAF and releases each run generation",
    run: async () => {
      const scheduler = new MazeSoakScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices();
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(MAZE_CHASE_MODULE, {
          players: 1,
          difficulty: "circuit",
          seed: 0x10_000 + cycle,
        });
        host.setRenderer(renderer);
        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each fresh launch must create exactly one service bundle");
        assert(host.activeGameId === "maze-chase" && host.loopRunning, "fresh launch must own the real Maze Chase runtime");
        assert(scheduler.pendingCount === 1, "active run must own exactly one pending frame");

        services.input.setHeld(1, "right", true);
        const base = cycle * 10_000;
        for (let frame = 0; frame < 16; frame += 1) {
          scheduler.fire(base + frame * 17);
        }
        assert(
          services.audio.playedEffects.includes(MAZE_CHASE_AUDIO_IDS.pellet),
          "real fixed-step updates must route Maze Chase collection audio through shared services",
        );
        assert(scheduler.pendingCount === 1, "gameplay must retain one RAF successor");

        host.pause();
        assert(host.simulationPaused && services.audio.pauseAllCount === 1, "pause must freeze timing and suspend shared audio exactly once");
        host.setRenderer(null);
        host.setRenderer(renderer);
        assert(scheduler.pendingCount === 1, "renderer detach/reattach must not fork frame ownership");
        host.resume();
        assert(!host.simulationPaused && services.audio.resumeAllCount === 1, "resume must reactivate shared timing/audio");

        await host.restart();
        assert(host.activeGameId === "maze-chase", "restart must retain game selection with a fresh instance");
        assert(scheduler.pendingCount === 1, "restart timing reset must preserve exactly one RAF chain");
        assert(services.audio.activeCount === 0, "restart must centrally clear prior one-shot audio ownership");
        assert(services.audio.stopAllCount >= 1, "restart must invoke centralized audio cleanup");
        assert(!services.input.isHeld(1, "right"), "restart must clear stale directional input state");

        host.exit();
        assert(host.activeGameId === null && !host.loopRunning, "exit must release the active runtime and frame driver");
        assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final pending frame");
        assert(services.audio.activeCount === 0 && services.audio.stopAllCount >= 2, "exit must leave no audio/resource ownership from either run generation");
      }

      assert(servicesByLaunch.length === cycles, "soak must create one service bundle per fresh launch");
      assert(scheduler.maxPendingCount === 1, "forty launch/restart/exit cycles must never accumulate duplicate RAF callbacks");
    },
  },
];
