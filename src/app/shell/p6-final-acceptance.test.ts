import {
  GameRegistry,
  MemoryJsonDocumentStore,
  ScoreRepository,
  defineGameMetadata,
  type AudioSettings,
  type GameModule,
  type GameStartOptions,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import {
  LifecycleGameHost,
  type GameLaunchPhaseReporter,
  type ShellGameHost,
} from "./game-host.js";

function gameModule(id: string, title: string): GameModule {
  return {
    metadata: defineGameMetadata({
      id,
      title,
      description: `${title} final acceptance fixture`,
      version: 1,
      players: [1, 2],
      supportedInputs: ["keyboard", "gamepad"],
      logicalWidth: 320,
      logicalHeight: 240,
      defaultDifficulty: "easy",
      difficulties: [
        { id: "easy", label: "Easy" },
        { id: "hard", label: "Hard" },
      ],
      controls: [{ action: "action-1", label: "Fire" }],
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
}

class RecordingHost implements ShellGameHost {
  public launches: GameStartOptions[] = [];

  public launch(
    _module: GameModule,
    options: GameStartOptions,
    reportPhase: GameLaunchPhaseReporter = () => undefined,
  ): Promise<void> {
    this.launches.push(options);
    reportPhase("loading");
    reportPhase("ready");
    reportPhase("running");
    return Promise.resolve();
  }

  public pause(): void {}
  public resume(): void {}
  public restart(): Promise<void> {
    return Promise.resolve();
  }
  public exit(): void {}
}

function controllerFor(
  modules: readonly GameModule[],
  documents = new MemoryJsonDocumentStore(),
  extras: {
    readonly fullscreen?: { setFullscreen(enabled: boolean): Promise<void> };
    readonly audio?: { configure(settings: AudioSettings): void };
  } = {},
): ShellController {
  const common = {
    registry: new GameRegistry(modules),
    documents,
    gameHost: new RecordingHost(),
  };
  if (extras.fullscreen !== undefined && extras.audio !== undefined) {
    return new ShellController({
      ...common,
      fullscreen: extras.fullscreen,
      audio: extras.audio,
    });
  }
  if (extras.fullscreen !== undefined) {
    return new ShellController({ ...common, fullscreen: extras.fullscreen });
  }
  if (extras.audio !== undefined) {
    return new ShellController({ ...common, audio: extras.audio });
  }
  return new ShellController(common);
}

export const tests: readonly TestCase[] = [
  {
    name: "P6-002 every registered launcher game is selectable without pointer input",
    run: async () => {
      const modules = [
        gameModule("alpha-game", "Alpha Game"),
        gameModule("beta-game", "Beta Game"),
        gameModule("gamma-game", "Gamma Game"),
      ];

      for (let target = 0; target < modules.length; target += 1) {
        const controller = controllerFor(modules);
        for (let move = 0; move < target; move += 1) {
          await controller.handleCommand("down");
        }
        await controller.handleCommand("activate");
        assert(
          controller.snapshot.selection?.gameId === modules[target]!.metadata.id,
          `launcher game ${target} must be selectable through normalized keyboard/controller commands`,
        );
        assert(
          String(controller.snapshot.screen) === "pre-game",
          "pointerless launcher selection must enter pre-game",
        );
      }
    },
  },
  {
    name: "P6-005 pause freezes simulation and pauses game-owned audio until resume",
    run: async () => {
      const services = createFakeGameServices();
      let updates = 0;
      let pauses = 0;
      let resumes = 0;
      const module: GameModule = {
        metadata: gameModule("pause-game", "Pause Game").metadata,
        create: () => ({
          start: () => undefined,
          update: () => {
            updates += 1;
          },
          render: () => undefined,
          pause: () => {
            pauses += 1;
          },
          resume: () => {
            resumes += 1;
          },
          reset: () => undefined,
          destroy: () => undefined,
        }),
      };
      const host = new LifecycleGameHost(() => services);
      await host.launch(module, { players: 1, difficulty: "easy", seed: 5 });
      services.audio.playLoop("game-loop");
      host.update(1 / 60);
      assert(Number(updates) === 1, "running simulation must update before pause");

      host.pause();
      host.update(1 / 60);
      assert(Number(pauses) === 1, "game instance must receive pause exactly once");
      assert(Number(updates) === 1, "paused runtime must not advance simulation");
      assert(services.audio.pauseAllCount === 1, "pause must suspend game-owned audio");

      host.resume();
      host.update(1 / 60);
      assert(Number(resumes) === 1, "game instance must receive resume exactly once");
      assert(Number(updates) === 2, "resumed runtime must advance simulation again");
      assert(services.audio.resumeAllCount === 1, "resume must restore game-owned audio");
    },
  },
  {
    name: "P6-008 edited settings apply live and survive controller recreation",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const modules = [gameModule("settings-game", "Settings Game")];
      const audioCalls: AudioSettings[] = [];
      const fullscreenCalls: boolean[] = [];
      const controller = controllerFor(modules, documents, {
        audio: {
          configure: (settings) => {
            audioCalls.push(Object.freeze({ ...settings }));
          },
        },
        fullscreen: {
          setFullscreen: (enabled) => {
            fullscreenCalls.push(enabled);
            return Promise.resolve();
          },
        },
      });

      await controller.initialize();
      await controller.setVolume("masterVolume", 0.35);
      await controller.setMuted(true);
      await controller.setVisual("reducedEffects", true);
      await controller.setVisual("pixelSmoothing", true);
      const remapped = await controller.remapKeyboard(1, "action-1", "KeyQ");
      await controller.setFullscreen(true);

      assert(remapped, "valid remap must apply without manual file editing");
      assert(audioCalls.at(-1)?.masterVolume === 0.35, "edited volume must apply through audio boundary");
      assert(audioCalls.at(-1)?.muted === true, "mute must apply through audio boundary");
      assert(fullscreenCalls.at(-1) === true, "fullscreen must apply through native boundary");
      assert(controller.snapshot.settings.visual.reducedEffects, "reduced effects must apply to live settings state");
      assert(controller.snapshot.settings.visual.pixelSmoothing, "pixel smoothing must apply to live settings state");

      const restored = controllerFor(modules, documents);
      await restored.initialize();
      assert(restored.snapshot.settings.audio.masterVolume === 0.35, "volume must persist");
      assert(restored.snapshot.settings.audio.muted, "mute must persist");
      assert(restored.snapshot.settings.visual.reducedEffects, "reduced effects must persist");
      assert(restored.snapshot.settings.visual.pixelSmoothing, "pixel smoothing must persist");
      assert(
        restored.snapshot.settings.input.keyboard[1]["action-1"][0] === "KeyQ",
        "keyboard remap must persist",
      );
      assert(restored.snapshot.settings.fullscreen, "fullscreen setting must persist");
    },
  },
  {
    name: "P6-009 high-score view filters by exact game mode and difficulty",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const scores = new ScoreRepository(documents);
      await scores.submitScore("score-game", "easy", {
        mode: "default",
        score: 700,
        initials: "EZY",
        timestamp: "2026-08-28T11:00:00.000Z",
      });
      await scores.submitScore("score-game", "hard", {
        mode: "default",
        score: 900,
        initials: "HRD",
        timestamp: "2026-08-28T11:01:00.000Z",
      });
      await scores.submitScore("score-game", "easy", {
        mode: "marathon",
        score: 1100,
        initials: "MAR",
        timestamp: "2026-08-28T11:02:00.000Z",
      });
      await scores.submitScore("other-game", "easy", {
        mode: "default",
        score: 1300,
        initials: "OTH",
        timestamp: "2026-08-28T11:03:00.000Z",
      });

      const controller = controllerFor(
        [gameModule("score-game", "Score Game"), gameModule("other-game", "Other Game")],
        documents,
      );
      controller.chooseGame("score-game");
      await controller.openScores();
      assert(controller.snapshot.scores.length === 1, "easy/default must exclude other games, modes, and difficulties");
      assert(Number(controller.snapshot.scores[0]?.score) === 700, "easy/default must show its exact score set");

      controller.closeScores();
      controller.setDifficulty("hard");
      await controller.openScores();
      assert(controller.snapshot.scores.length === 1, "hard/default must remain exactly filtered");
      assert(Number(controller.snapshot.scores[0]?.score) === 900, "hard/default must show its exact score set");
    },
  },
  {
    name: "P6-011 fullscreen preference round-trips and startup failure remains recoverable",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const modules = [gameModule("fullscreen-game", "Fullscreen Game")];
      const firstCalls: boolean[] = [];
      const first = controllerFor(modules, documents, {
        fullscreen: {
          setFullscreen: (enabled) => {
            firstCalls.push(enabled);
            return Promise.resolve();
          },
        },
      });
      await first.initialize();
      await first.setFullscreen(true);
      assert(firstCalls.join(",") === "true", "enabling fullscreen must apply immediately");

      const restoredCalls: boolean[] = [];
      const restored = controllerFor(modules, documents, {
        fullscreen: {
          setFullscreen: (enabled) => {
            restoredCalls.push(enabled);
            return Promise.resolve();
          },
        },
      });
      await restored.initialize();
      assert(restored.snapshot.settings.fullscreen, "fullscreen preference must be remembered");
      assert(restoredCalls.join(",") === "true", "remembered fullscreen preference must apply at startup");

      const failing = controllerFor(modules, documents, {
        fullscreen: {
          setFullscreen: () => Promise.reject(new Error("window manager refused")),
        },
      });
      await failing.initialize();
      assert(failing.snapshot.settings.fullscreen, "failed startup application must not erase preference");
      assert(
        failing.snapshot.warning?.includes("window manager refused") === true,
        "fullscreen startup failure must be recoverable and visible",
      );
      assert(failing.snapshot.screen === "launcher", "fullscreen failure must leave launcher usable");
    },
  },
  {
    name: "P5-011 corrupt scores surface through the P6 launcher warning boundary",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      documents.setRaw("scores", "{ invalid score json");
      const controller = controllerFor([gameModule("recovery-game", "Recovery Game")], documents);
      await controller.initialize();

      assert(
        controller.snapshot.warning?.includes("Stored scores were invalid and ignored") === true,
        "corrupt score recovery must be visible through launcher warning state",
      );
      assert(controller.snapshot.screen === "launcher", "corrupt scores must leave launcher usable");
    },
  },
];
