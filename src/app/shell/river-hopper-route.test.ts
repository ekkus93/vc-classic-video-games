import {
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { RIVER_HOPPER_AUDIO_IDS } from "../../games/river-hopper/effects.js";
import { createGameRegistry } from "../../games/registry.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class RouteScheduler implements FrameScheduler {
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
    name: "P9 controller-only route launches, drives, restarts, and exits real River Hopper",
    run: async () => {
      const scheduler = new RouteScheduler();
      const services = createFakeGameServices(0x9009);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: createGameRegistry(),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      assert(controller.games[controller.snapshot.launcherFocusIndex]?.id === "river-hopper", "canonical launcher must expose River Hopper");
      await controller.handleCommand("down");
      assert(controller.games[controller.snapshot.launcherFocusIndex]?.id === "space-rocks", "controller navigation must still reach Space Rocks");
      await controller.handleCommand("up");
      assert(controller.games[controller.snapshot.launcherFocusIndex]?.id === "river-hopper", "controller navigation must return to registered River Hopper");
      await controller.handleCommand("activate");
      assert(
        controller.snapshot.screen === "pre-game" && controller.selectedGame?.id === "river-hopper",
        "controller activation must reach River Hopper pre-game",
      );
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch River Hopper");
      assert(host.activeGameId === "river-hopper" && host.loopRunning, "real River Hopper runtime must own one running host");
      assert(scheduler.pendingCount === 1, "launch must own exactly one RAF callback");
      assert(services.audio.isActive(RIVER_HOPPER_AUDIO_IDS.current), "real module must start shared ambient audio");

      services.input.setHeld(1, "up", true);
      scheduler.fire(0);
      scheduler.fire(17);
      assert(
        services.audio.playedEffects.includes(RIVER_HOPPER_AUDIO_IDS.hop),
        "normalized directional game input must reach the real module",
      );
      assert(scheduler.pendingCount === 1, "gameplay must retain one RAF successor");

      await controller.handleCommand("pause");
      assert(controller.snapshot.gamePaused && host.simulationPaused, "shared pause must freeze River Hopper simulation");
      assert(services.audio.pauseAllCount === 1, "shared pause must suspend game audio");
      await controller.handleCommand("down");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game" && !controller.snapshot.gamePaused, "pause-menu restart must start a fresh run");
      assert(scheduler.pendingCount === 1, "restart must not create a duplicate RAF chain");
      assert(services.audio.playedLoops.filter((id) => id === RIVER_HOPPER_AUDIO_IDS.current).length === 2, "fresh instance must own one replacement ambient loop");

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "launcher", "controller-only return must restore launcher");
      assert(host.activeGameId === null && !host.loopRunning, "exit must release runtime ownership");
      assert(Number(scheduler.pendingCount) === 0, "exit must cancel final RAF callback");
      assert(services.audio.activeCount === 0, "exit must release all River Hopper audio");
    },
  },
];
