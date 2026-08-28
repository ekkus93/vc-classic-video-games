import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
import { ShellView } from "./ShellView.js";
import { ShellController } from "./controller.js";
import {
  LifecycleGameHost,
  type GameLaunchPhaseReporter,
  type ShellGameHost,
} from "./game-host.js";

function gameModule(
  id: string,
  title: string,
  options: {
    readonly players?: readonly number[];
    readonly difficulties?: readonly { readonly id: string; readonly label: string }[];
    readonly defaultDifficulty?: string;
  } = {},
): GameModule {
  const difficulties = options.difficulties ?? [
    { id: "easy", label: "Easy" },
    { id: "hard", label: "Hard" },
  ];
  return {
    metadata: defineGameMetadata({
      id,
      title,
      description: `${title} acceptance fixture`,
      version: 1,
      players: options.players ?? [1, 2],
      supportedInputs: ["keyboard", "gamepad"],
      logicalWidth: 320,
      logicalHeight: 240,
      defaultDifficulty: options.defaultDifficulty ?? difficulties[0]!.id,
      difficulties,
      controls: [
        {
          action: "action-1",
          label: "Fire",
          description: "Fire the primary weapon",
        },
      ],
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
  public pauseCount = 0;
  public resumeCount = 0;
  public restartCount = 0;
  public exitCount = 0;

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

  public pause(): void {
    this.pauseCount += 1;
  }

  public resume(): void {
    this.resumeCount += 1;
  }

  public restart(): Promise<void> {
    this.restartCount += 1;
    return Promise.resolve();
  }

  public exit(): void {
    this.exitCount += 1;
  }
}

function controllerFor(
  modules: readonly GameModule[],
  documents = new MemoryJsonDocumentStore(),
  host: ShellGameHost = new RecordingHost(),
  extras: {
    readonly fullscreen?: { setFullscreen(enabled: boolean): Promise<void> };
    readonly audio?: { configure(settings: AudioSettings): void };
  } = {},
): ShellController {
  const common = {
    registry: new GameRegistry(modules),
    documents,
    gameHost: host,
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
    name: "P6-001 registry entries automatically render launcher cards and persisted high scores",
    run: async () => {
      const alpha = gameModule("alpha-game", "Alpha Game");
      const beta = gameModule("beta-game", "Beta Game");
      const documents = new MemoryJsonDocumentStore();
      const scores = new ScoreRepository(documents);
      await scores.submitScore("alpha-game", "easy", {
        mode: "default",
        score: 4200,
        initials: "AAA",
        timestamp: "2026-08-28T10:00:00.000Z",
      });
      const controller = controllerFor([beta, alpha], documents);
      await controller.initialize();
      const markup = renderToStaticMarkup(
        createElement(ShellView, { controller, state: controller.snapshot }),
      );

      assert(markup.includes("Alpha Game"), "first registry game must render a launcher card");
      assert(markup.includes("Beta Game"), "second registry game must render a launcher card");
      assert(markup.includes(">AL<"), "launcher art must derive from Alpha metadata");
      assert(markup.includes(">BE<"), "launcher art must derive from Beta metadata");
      assert(markup.includes("High score: 4,200"), "persisted best score must render on its game card");
      assert(markup.includes("No high score yet"), "games without scores must render an explicit empty score state");
    },
  },
  {
    name: "P6-002 every launcher game is selectable through normalized keyboard/controller navigation",
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
          `launcher game ${target} must be selectable without pointer input`,
        );
        assert(controller.snapshot.screen === "pre-game", "selection must enter pre-game");
      }
    },
  },
  {
    name: "P6-003 pre-game player difficulty controls and help are metadata-driven",
    run: async () => {
      const module = gameModule("metadata-game", "Metadata Game", {
        players: [1, 3],
        difficulties: [
          { id: "novice", label: "Novice" },
          { id: "expert", label: "Expert" },
        ],
        defaultDifficulty: "novice",
      });
      const controller = controllerFor([module]);
      controller.chooseGame("metadata-game");
      let markup = renderToStaticMarkup(
        createElement(ShellView, { controller, state: controller.snapshot }),
      );

      assert(markup.includes("Start game"), "pre-game must expose Start");
      assert(markup.includes("High scores"), "pre-game must expose high scores");
      assert(markup.includes("Controls &amp; settings"), "pre-game must expose controls/help");
      assert(markup.includes("Novice") && markup.includes("Expert"), "difficulty labels must come from metadata");
      assert(markup.includes("Fire the primary weapon"), "control help must come from metadata");

      await controller.handleCommand("down");
      await controller.handleCommand("right");
      assert(controller.snapshot.selection?.players === 3, "player count must cycle through metadata options");
      await controller.handleCommand("down");
      await controller.handleCommand("right");
      assert(controller.snapshot.selection?.difficulty === "expert", "difficulty must cycle through metadata options");

      markup = renderToStaticMarkup(
        createElement(ShellView, { controller, state: controller.snapshot }),
      );
      assert(markup.includes("expert") || markup.includes("Expert"), "updated metadata choice must remain rendered");
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
      assert(updates === 1, "running simulation must update before pause");

      host.pause();
      host.update(1 / 60);
      assert(pauses === 1, "game instance must receive pause exactly once");
      assert(updates === 1, "paused runtime must not advance simulation");
      assert(services.audio.pauseAllCount === 1, "pause must suspend game-owned audio");

      host.resume();
      host.update(1 / 60);
      assert(resumes === 1, "game instance must receive resume exactly once");
      assert(updates === 2, "resumed runtime must advance simulation again");
      assert(services.audio.resumeAllCount === 1, "resume must restore game-owned audio");
    },
  },
  {
    name: "P6-005 pause overlay exposes every required shell action",
    run: async () => {
      const host = new RecordingHost();
      const controller = controllerFor([gameModule("pause-ui", "Pause UI")], new MemoryJsonDocumentStore(), host);
      controller.chooseGame("pause-ui");
      await controller.launchSelected();
      controller.pauseGame();
      const markup = renderToStaticMarkup(
        createElement(ShellView, { controller, state: controller.snapshot }),
      );

      for (const label of ["Resume", "Restart", "Controls", "Sound", "Return to launcher"]) {
        assert(markup.includes(label), `pause overlay must expose ${label}`);
      }
    },
  },
  {
    name: "P6-007 return to launcher destroys the active game and is immediately interactive",
    run: async () => {
      const services = createFakeGameServices();
      let destroyed = 0;
      const module: GameModule = {
        metadata: gameModule("exit-game", "Exit Game").metadata,
        create: () => ({
          start: () => undefined,
          update: () => undefined,
          render: () => undefined,
          pause: () => undefined,
          resume: () => undefined,
          reset: () => undefined,
          destroy: () => {
            destroyed += 1;
          },
        }),
      };
      const host = new LifecycleGameHost(() => services);
      const controller = controllerFor([module], new MemoryJsonDocumentStore(), host);
      controller.chooseGame("exit-game");
      await controller.launchSelected();
      controller.returnToLauncher();

      assert(destroyed === 1, "return to launcher must destroy the active game instance");
      assert(host.activeGameId === null, "return to launcher must release active game ownership");
      assert(services.audio.stopAllCount >= 1, "return to launcher must stop game-owned audio");
      assert(controller.snapshot.screen === "launcher", "launcher must become current immediately");
      assert(!controller.snapshot.busy, "launcher must be interactive immediately");

      await controller.handleCommand("activate");
      assert(controller.snapshot.screen === "pre-game", "launcher must accept a new command immediately after exit");
    },
  },
  {
    name: "P6-008 settings persist and apply through shared audio fullscreen visual and input boundaries",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const modules = [gameModule("settings-game", "Settings Game")];
      const audioCalls: AudioSettings[] = [];
      const fullscreenCalls: boolean[] = [];
      const controller = controllerFor(modules, documents, new RecordingHost(), {
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

      assert(remapped, "valid keyboard remap must apply through settings UI boundary");
      assert(audioCalls.length >= 3, "audio settings must apply live during initialization and edits");
      assert(audioCalls.at(-1)?.masterVolume === 0.35, "live audio configuration must receive edited volume");
      assert(audioCalls.at(-1)?.muted === true, "live audio configuration must receive mute state");
      assert(fullscreenCalls.at(-1) === true, "fullscreen setting must apply through native boundary");
      assert(controller.snapshot.settings.visual.reducedEffects, "reduced-effects setting must apply to live shell state");
      assert(controller.snapshot.settings.visual.pixelSmoothing, "pixel-smoothing setting must apply to live shell state");

      const restoredAudio: AudioSettings[] = [];
      const restoredFullscreen: boolean[] = [];
      const restored = controllerFor(modules, documents, new RecordingHost(), {
        audio: {
          configure: (settings) => {
            restoredAudio.push(Object.freeze({ ...settings }));
          },
        },
        fullscreen: {
          setFullscreen: (enabled) => {
            restoredFullscreen.push(enabled);
            return Promise.resolve();
          },
        },
      });
      await restored.initialize();

      assert(restored.snapshot.settings.audio.masterVolume === 0.35, "edited volume must persist");
      assert(restored.snapshot.settings.audio.muted, "mute must persist");
      assert(restored.snapshot.settings.visual.reducedEffects, "reduced effects must persist");
      assert(restored.snapshot.settings.visual.pixelSmoothing, "pixel smoothing must persist");
      assert(
        restored.snapshot.settings.input.keyboard[1]["action-1"][0] === "KeyQ",
        "keyboard remap must persist",
      );
      assert(restored.snapshot.settings.fullscreen, "fullscreen preference must persist");
      assert(restoredAudio.at(-1)?.masterVolume === 0.35, "restored audio settings must apply on startup");
      assert(restoredFullscreen.join(",") === "true", "restored fullscreen preference must apply on startup");
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
      assert(controller.snapshot.scores.length === 1, "easy/default view must exclude other modes, difficulties, and games");
      assert(controller.snapshot.scores[0]?.score === 700, "easy/default view must show only its exact score set");

      controller.closeScores();
      controller.setDifficulty("hard");
      await controller.openScores();
      assert(controller.snapshot.scores.length === 1, "hard/default view must remain exactly filtered");
      assert(controller.snapshot.scores[0]?.score === 900, "hard/default view must show the hard score set");
    },
  },
  {
    name: "P6-011 fullscreen preference round-trips and startup failure remains recoverable",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const modules = [gameModule("fullscreen-game", "Fullscreen Game")];
      const firstCalls: boolean[] = [];
      const first = controllerFor(modules, documents, new RecordingHost(), {
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
      const restored = controllerFor(modules, documents, new RecordingHost(), {
        fullscreen: {
          setFullscreen: (enabled) => {
            restoredCalls.push(enabled);
            return Promise.resolve();
          },
        },
      });
      await restored.initialize();
      assert(restored.snapshot.settings.fullscreen, "stored fullscreen preference must be remembered");
      assert(restoredCalls.join(",") === "true", "remembered fullscreen preference must be applied at startup");

      const failing = controllerFor(modules, documents, new RecordingHost(), {
        fullscreen: {
          setFullscreen: () => Promise.reject(new Error("window manager refused")),
        },
      });
      await failing.initialize();
      assert(failing.snapshot.settings.fullscreen, "fullscreen failure must not erase remembered preference");
      assert(
        failing.snapshot.warning?.includes("window manager refused") === true,
        "startup fullscreen failure must remain recoverable and visible",
      );
      assert(failing.snapshot.screen === "launcher", "fullscreen failure must leave launcher usable");
    },
  },
  {
    name: "P5-011 score corruption is surfaced through the P6 launcher warning boundary",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      documents.setRaw("scores", "{ invalid score json");
      const controller = controllerFor([gameModule("recovery-game", "Recovery Game")], documents);
      await controller.initialize();

      assert(
        controller.snapshot.warning?.includes("Stored scores were invalid and ignored") === true,
        "corrupt score recovery must be visible through launcher warning state",
      );
      assert(controller.snapshot.screen === "launcher", "corrupt scores must not make launcher unusable");
    },
  },
];
