import {
  GameRegistry,
  MemoryJsonDocumentStore,
  type FrameCallback,
  type FrameScheduler,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { MAZE_CHASE_MODULE } from "../../games/maze-chase/module.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { LoopingGameHost } from "./looping-game-host.js";

class MazeRouteScheduler implements FrameScheduler {
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

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "P10-011 controller-only route launches pauses restarts and exits real Maze Chase",
    run: async () => {
      const scheduler = new MazeRouteScheduler();
      const services = createFakeGameServices(0x10f1);
      const host = new LoopingGameHost(() => services, undefined, scheduler);
      const controller = new ShellController({
        registry: new GameRegistry([MAZE_CHASE_MODULE]),
        documents: new MemoryJsonDocumentStore(),
        gameHost: host,
      });
      await controller.initialize();

      assert(controller.snapshot.screen === "launcher" && controller.games.length === 1, "isolated fixture must begin on the Maze Chase launcher card");
      await controller.handleCommand("activate");
      assert(
        String(controller.snapshot.screen) === "pre-game" &&
          controller.selectedGame?.id === "maze-chase",
        "controller activation must enter Maze Chase pre-game configuration",
      );
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game", "pre-game activation must launch the real module");
      assert(host.activeGameId === "maze-chase" && host.loopRunning, "Maze Chase must own one running fixed-step host");
      assert(scheduler.pendingCount === 1, "launch must own exactly one frame callback");

      await controller.handleCommand("pause");
      assert(Boolean(controller.snapshot.gamePaused) && host.simulationPaused, "shared pause command must freeze Maze Chase simulation");
      await controller.handleCommand("down");
      assert(Number(controller.snapshot.pauseFocusIndex) === 1, "controller navigation must focus Restart");
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "game" && !Boolean(controller.snapshot.gamePaused), "restart must return to a fresh running game");
      assert(scheduler.pendingCount === 1, "restart must not create a second RAF chain");

      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      await controller.handleCommand("activate");
      assert(String(controller.snapshot.screen) === "launcher", "controller-only exit must recover the launcher");
      assert(host.activeGameId === null && !host.loopRunning, "exit must release Maze Chase runtime ownership");
      assert(Number(scheduler.pendingCount) === 0, "exit must cancel the final frame callback");
      assert(services.audio.activeCount === 0, "exit must leave no game-owned audio active");
    },
  },
];
