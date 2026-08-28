import {
  defineGameMetadata,
  type GameModule,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  LifecycleGameHost,
  type GameLaunchPhase,
  type GameRunTimingPort,
} from "./game-host.js";

export const tests: readonly TestCase[] = [
  {
    name: "lifecycle host reports loading ready running in verified runtime order",
    run: async () => {
      const services = createFakeGameServices();
      const phases: GameLaunchPhase[] = [];
      const module: GameModule = {
        metadata: defineGameMetadata({
          id: "phase-test",
          title: "Phase Test",
          description: "Launch phase acceptance fixture",
          version: 1,
          players: [1],
          supportedInputs: ["keyboard"],
          logicalWidth: 320,
          logicalHeight: 240,
          defaultDifficulty: "normal",
          difficulties: [{ id: "normal", label: "Normal" }],
          controls: [],
          assetManifest: "assets.json",
        }),
        create: () => ({
          start: () => undefined,
          update: () => undefined,
          render: () => undefined,
          pause: () => undefined,
          resume: () => undefined,
          reset: () => undefined,
          destroy: () => undefined,
        }),
      };
      const host = new LifecycleGameHost(() => services);

      await host.launch(
        module,
        { players: 1, difficulty: "normal", seed: 3 },
        (phase) => phases.push(phase),
      );

      assert(
        phases.join(",") === "loading,ready,running",
        "launch phases must follow verified P2 runtime state order",
      );
      assert(
        host.activeGameId === "phase-test",
        "running transition must retain active game ownership",
      );
    },
  },
  {
    name: "restart creates a fresh run with no stale entities input timers or audio",
    run: async () => {
      const services = createFakeGameServices();
      const timing: GameRunTimingPort & { resetCount: number } = {
        resetCount: 0,
        resetForNewRun() {
          this.resetCount += 1;
        },
      };
      const instances: Array<{
        entityCount: number;
        timerSeconds: number;
        destroyed: boolean;
        startSeed: number | null;
      }> = [];
      const module: GameModule = {
        metadata: defineGameMetadata({
          id: "host-test",
          title: "Host Test",
          description: "Lifecycle host acceptance fixture",
          version: 1,
          players: [1],
          supportedInputs: ["keyboard"],
          logicalWidth: 320,
          logicalHeight: 240,
          defaultDifficulty: "normal",
          difficulties: [{ id: "normal", label: "Normal" }],
          controls: [],
          assetManifest: "assets.json",
        }),
        create: () => {
          const state = {
            entityCount: 1,
            timerSeconds: 0,
            destroyed: false,
            startSeed: null as number | null,
          };
          instances.push(state);
          return {
            start: (options) => {
              state.startSeed = options.seed;
            },
            update: (dtSeconds) => {
              state.entityCount += 1;
              state.timerSeconds += dtSeconds;
            },
            render: () => undefined,
            pause: () => undefined,
            resume: () => undefined,
            reset: () => {
              throw new Error("shell restart must recreate rather than reuse an instance");
            },
            destroy: () => {
              state.destroyed = true;
            },
          };
        },
      };
      const host = new LifecycleGameHost(
        () => services,
        () => undefined,
        timing,
      );

      await host.launch(module, { players: 1, difficulty: "normal", seed: 7 });
      host.update(0.5);
      services.input.setHeld(1, "action-1", true);
      services.input.pointer.set({
        position: { x: 20, y: 30 },
        inside: true,
        primaryHeld: true,
        primaryPressed: true,
        primaryReleased: false,
      });
      services.audio.playLoop("stale-loop");
      host.pause();

      const oldRun = instances[0];
      assert(oldRun !== undefined, "fixture must create the initial run");
      assert(oldRun.entityCount === 2, "fixture must contain mutated entity state");
      assert(oldRun.timerSeconds === 0.5, "fixture must contain mutated timer state");
      assert(services.input.isHeld(1, "action-1"), "fixture must contain held input");
      assert(services.audio.isActive("stale-loop"), "fixture must contain active audio");

      await host.restart();

      const newRun = instances[1];
      assert(instances.length === 2, "restart must create exactly one fresh instance");
      assert(newRun !== undefined, "restart must create a replacement run");
      assert(oldRun.destroyed, "restart must destroy the previous game instance");
      assert(newRun !== oldRun, "restart must not reuse the previous game instance");
      assert(newRun.entityCount === 1, "fresh run must start with fresh entity state");
      assert(newRun.timerSeconds === 0, "fresh run must start with fresh simulation timers");
      assert(newRun.startSeed === 7, "restart must preserve selected run options");
      assert(!services.input.isHeld(1, "action-1"), "restart must clear held input");
      assert(!services.input.wasPressed(1, "action-1"), "restart must clear input edges");
      assert(
        services.input.pointer.snapshot().inside === false,
        "restart must clear stale pointer state",
      );
      assert(timing.resetCount === 1, "restart must reset fixed-step timing once");
      assert(services.audio.activeCount === 0, "restart must stop all old game audio");
      assert(services.audio.stopAllCount >= 1, "runtime destruction must invoke audio cleanup");
      assert(services.audio.resumeAllCount === 1, "new run must resume audio after restart");

      host.update(0.25);
      assert(oldRun.entityCount === 2, "destroyed entities must never update again");
      assert(oldRun.timerSeconds === 0.5, "destroyed timers must never advance again");
      assert(newRun.entityCount === 2, "only fresh entities may update after restart");
      assert(newRun.timerSeconds === 0.25, "only fresh timers may advance after restart");

      host.exit();
      assert(newRun.destroyed, "exit must destroy the replacement instance");
      assert(host.activeGameId === null, "exit must release active ownership");
    },
  },
];
