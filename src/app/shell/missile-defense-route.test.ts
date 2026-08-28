import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import {
  createFakeGameServices,
  type FakeGameServices,
} from "../../engine/testing/fake-services.js";
import { MISSILE_DEFENSE_AUDIO_IDS } from "../../games/missile-defense/effects.js";
import { MISSILE_DEFENSE_MODULE } from "../../games/missile-defense/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class MissileDefenseFrameScheduler implements FrameScheduler {
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
    name: "P8-009 real controller-only route launches aims fires restarts and exits Missile Defense",
    run: async () => {
      const scheduler = new MissileDefenseFrameScheduler();
      const services = createFakeGameServices(0x8008);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([MISSILE_DEFENSE_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();
      await controller.handleCommand("activate");
      assert(controller.selectedGame?.id === "missile-defense", "launcher activation must select P8");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch P8");
      assert(host.activeGameId === "missile-defense" && scheduler.pendingCount === 1, "P8 must own one real loop");

      services.input.setHeld(1, "left", true);
      services.input.setHeld(1, "up", true);
      services.input.setHeld(1, "action-1", true);
      scheduler.fire(0);
      scheduler.fire(17);
      assert(
        services.audio.playedEffects.includes(MISSILE_DEFENSE_AUDIO_IDS.launch),
        "gamepad logical actions must aim/fire without pointer input",
      );

      await controller.handleCommand("pause");
      await controller.handleCommand("down");
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "game" && !controller.snapshot.gamePaused,
        "controller-only Restart must restore gameplay",
      );
      assert(scheduler.pendingCount === 1, "restart must retain one frame callback");
      assert(!services.input.isHeld(1, "left"), "restart must clear stale controller state");

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "launcher", "controller-only exit must restore launcher");
      assert(host.activeGameId === null && Number(scheduler.pendingCount) === 0, "exit must release runtime and RAF");
      assert(services.audio.activeCount === 0, "exit must release game-owned audio");
    },
  },
  {
    name: "P8-010 Missile Defense lifecycle soak retains one RAF and cleans restart/exit ownership",
    run: async () => {
      const scheduler = new MissileDefenseFrameScheduler();
      const servicesByLaunch: FakeGameServices[] = [];
      const host = new LoopingGameHost(() => {
        const services = createFakeGameServices(0x8000 + servicesByLaunch.length);
        servicesByLaunch.push(services);
        return services;
      }, undefined, scheduler);
      const renderer = new FakeGameRenderer();
      const cycles = 40;

      for (let cycle = 0; cycle < cycles; cycle += 1) {
        await host.launch(MISSILE_DEFENSE_MODULE, {
          players: 1,
          difficulty: "guard",
          seed: 0x8100 + cycle,
        });
        host.setRenderer(renderer);
        const services = servicesByLaunch[cycle];
        assert(services !== undefined, "each launch must create one service bundle");
        assert(scheduler.pendingCount === 1, "active run must own one RAF callback");

        services.input.setHeld(1, "right", true);
        services.input.setHeld(1, "action-1", true);
        const base = cycle * 1000;
        scheduler.fire(base);
        scheduler.fire(base + 17);
        assert(
          services.audio.playedEffects.includes(MISSILE_DEFENSE_AUDIO_IDS.launch),
          "real P8 update must route launch audio through shared service",
        );
        assert(scheduler.pendingCount === 1, "update/render must preserve one RAF successor");

        host.pause();
        assert(host.simulationPaused && services.audio.pauseAllCount === 1, "pause must suspend runtime/audio");
        host.resume();
        assert(!host.simulationPaused && services.audio.resumeAllCount === 1, "resume must restore runtime/audio");
        await host.restart();
        assert(scheduler.pendingCount === 1, "restart must not create a second RAF chain");
        assert(services.audio.activeCount === 0, "restart must centrally stop prior-run audio");
        assert(!services.input.isHeld(1, "right"), "restart must clear stale directional state");

        scheduler.fire(base + 34);
        scheduler.fire(base + 51);
        host.exit();
        assert(host.activeGameId === null && !host.loopRunning, "exit must release active game ownership");
        assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final RAF callback");
        assert(services.audio.activeCount === 0, "exit must leave no game-owned audio");
      }

      assert(servicesByLaunch.length === cycles, "soak must use one service bundle per fresh launch");
      assert(scheduler.maxPendingCount === 1, "40-cycle soak must never retain duplicate RAF callbacks");
    },
  },
];
