import {
  defineGameMetadata,
  type GameModule,
  type GameStartOptions,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { LifecycleGameHost } from "./game-host.js";

export const tests: readonly TestCase[] = [
  {
    name: "lifecycle host pauses audio simulation and performs clean restart exit",
    run: async () => {
      const services = createFakeGameServices();
      const counts = {
        starts: 0,
        pauses: 0,
        resumes: 0,
        resets: 0,
        destroys: 0,
      };
      let lastOptions: GameStartOptions | null = null;
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
        create: () => ({
          start: (options) => {
            counts.starts += 1;
            lastOptions = options;
          },
          update: () => undefined,
          render: () => undefined,
          pause: () => {
            counts.pauses += 1;
          },
          resume: () => {
            counts.resumes += 1;
          },
          reset: () => {
            counts.resets += 1;
          },
          destroy: () => {
            counts.destroys += 1;
          },
        }),
      };
      const host = new LifecycleGameHost(() => services);

      await host.launch(module, { players: 1, difficulty: "normal", seed: 7 });
      host.pause();
      assert(counts.pauses === 1, "game instance must receive pause");
      assert(services.audio.pauseAllCount === 1, "game-owned audio must pause");
      host.resume();
      assert(counts.resumes === 1, "game instance must receive resume");
      assert(services.audio.resumeAllCount === 1, "game-owned audio must resume");

      await host.restart();
      assert(counts.resets === 1, "restart must reset instance");
      assert(counts.starts === 2, "restart must start a new run");
      assert(lastOptions?.seed === 7, "restart must preserve selected run options");
      assert(services.audio.stopAllCount >= 1, "restart must clear stale audio");

      host.exit();
      assert(counts.destroys === 1, "exit must destroy active instance");
      assert(host.activeGameId === null, "exit must release active ownership");
    },
  },
];
