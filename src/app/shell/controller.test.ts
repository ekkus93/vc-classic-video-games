import {
  GameRegistry,
  MemoryJsonDocumentStore,
  ScoreRepository,
  createDefaultGlobalSettings,
  defineGameMetadata,
  type GameModule,
  type GameStartOptions,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import type {
  GameLaunchPhaseReporter,
  ShellGameHost,
} from "./game-host.js";

function gameModule(id = "space-test", title = "Space Test"): GameModule {
  return {
    metadata: defineGameMetadata({
      id,
      title,
      description: "Deterministic shell test game",
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

class FakeGameHost implements ShellGameHost {
  public launches: GameStartOptions[] = [];
  public pauseCount = 0;
  public resumeCount = 0;
  public restartCount = 0;
  public exitCount = 0;
  public failLaunch = false;

  public launch(
    _module: GameModule,
    options: GameStartOptions,
    reportPhase: GameLaunchPhaseReporter = () => undefined,
  ): Promise<void> {
    reportPhase("loading");
    if (this.failLaunch) {
      return Promise.reject(new Error("injected launch failure"));
    }
    this.launches.push(options);
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

function createController(
  documents = new MemoryJsonDocumentStore(),
  host = new FakeGameHost(),
  fullscreen?: { setFullscreen(enabled: boolean): Promise<void> },
): { controller: ShellController; host: FakeGameHost; documents: MemoryJsonDocumentStore } {
  const common = {
    registry: new GameRegistry([gameModule()]),
    documents,
    gameHost: host,
  };
  return {
    controller:
      fullscreen === undefined
        ? new ShellController(common)
        : new ShellController({ ...common, fullscreen }),
    host,
    documents,
  };
}

function assertScreen(controller: ShellController, expected: string, message: string): void {
  assert(controller.snapshot.screen === expected, message);
}

export const tests: readonly TestCase[] = [
  {
    name: "registry metadata automatically populates the launcher model",
    run: () => {
      const { controller } = createController();
      assert(controller.games.length === 1, "one registered game must be visible");
      assert(controller.games[0]?.title === "Space Test", "metadata title must be exposed");
      controller.chooseGame("space-test");
      assertScreen(controller, "pre-game", "selection must open pre-game");
      assert(controller.snapshot.selection?.players === 1, "default player count must come from metadata");
      assert(controller.snapshot.selection?.difficulty === "easy", "default difficulty must come from metadata");
    },
  },
  {
    name: "launch transition is observable as loading ready running on one shell controller",
    run: async () => {
      const { controller } = createController();
      controller.chooseGame("space-test");
      const phases: string[] = [];
      let previous = controller.snapshot.launchPhase;
      const unsubscribe = controller.subscribe((state) => {
        if (state.launchPhase !== previous) {
          phases.push(state.launchPhase);
          previous = state.launchPhase;
        }
      });

      await controller.launchSelected();
      unsubscribe();

      assert(
        phases.join(",") === "loading,ready,running",
        "shell must expose the ordered loading ready running transition",
      );
      assertScreen(
        controller,
        "game",
        "running phase must enter game without reconstructing the shell",
      );
      assert(!controller.snapshot.busy, "running phase must clear launch busy state");
      assert(
        controller.snapshot.status === "Space Test running",
        "running phase must remain visible through shell status UI",
      );
    },
  },
  {
    name: "controller-only route can launch pause resume and exit without reloading",
    run: async () => {
      const { controller, host } = createController();
      await controller.handleCommand("activate");
      assertScreen(controller, "pre-game", "launcher activate must open pre-game");
      await controller.handleCommand("activate");
      assertScreen(controller, "game", "pre-game activate must launch");
      assert(host.launches.length === 1, "host must receive one launch");
      await controller.handleCommand("pause");
      assert(controller.snapshot.gamePaused, "pause command must open pause state");
      await controller.handleCommand("back");
      assert(!controller.snapshot.gamePaused, "pause back must resume");
      await controller.handleCommand("pause");
      for (let index = 0; index < 4; index += 1) {
        await controller.handleCommand("down");
      }
      await controller.handleCommand("activate");
      assertScreen(controller, "launcher", "pause menu must return to launcher");
      assert(host.exitCount >= 1, "exit must release game host ownership");
    },
  },
  {
    name: "restart keeps shell in game and delegates a clean reset",
    run: async () => {
      const { controller, host } = createController();
      controller.chooseGame("space-test");
      await controller.launchSelected();
      controller.pauseGame();
      await controller.restartGame();
      assert(host.restartCount === 1, "restart must be delegated once");
      assertScreen(controller, "game", "restart must stay in game");
      assert(!controller.snapshot.gamePaused, "restart must resume simulation state");
      assert(
        controller.snapshot.launchPhase === "running",
        "restart must leave shell in running launch phase",
      );
    },
  },
  {
    name: "launch failure remains recoverable on the pre-game screen",
    run: async () => {
      const host = new FakeGameHost();
      host.failLaunch = true;
      const { controller } = createController(new MemoryJsonDocumentStore(), host);
      controller.chooseGame("space-test");
      await controller.launchSelected();
      assertScreen(controller, "pre-game", "failed launch must remain recoverable");
      assert(
        controller.snapshot.launchPhase === "error",
        "failed launch must terminate in explicit error phase",
      );
      assert(controller.snapshot.error?.includes("injected launch failure") === true, "failure must be visible");
    },
  },
  {
    name: "settings and remapped controls persist across controller restart",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const first = createController(documents).controller;
      await first.initialize();
      await first.setMuted(true);
      await first.setVisual("reducedEffects", true);
      const changed = await first.remapKeyboard(1, "action-1", "KeyQ");
      assert(changed, "valid remap must succeed");

      const second = createController(documents).controller;
      await second.initialize();
      assert(second.snapshot.settings.audio.muted, "mute must persist");
      assert(second.snapshot.settings.visual.reducedEffects, "visual setting must persist");
      assert(
        second.snapshot.settings.input.keyboard[1]["action-1"][0] === "KeyQ",
        "keyboard remap must persist",
      );
    },
  },
  {
    name: "stored fullscreen preference is applied and failure becomes a warning",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      await documents.save("settings", JSON.stringify(createDefaultGlobalSettings()));
      let calls = 0;
      const { controller } = createController(documents, new FakeGameHost(), {
        setFullscreen: () => {
          calls += 1;
          return Promise.reject(new Error("window manager refused"));
        },
      });
      await controller.initialize();
      assert(calls === 1, "fullscreen preference must be attempted at startup");
      assert(
        controller.snapshot.warning?.includes("window manager refused") === true,
        "fullscreen failure must be recoverable and visible",
      );
    },
  },
  {
    name: "high-score view uses selected game mode and difficulty ordering",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const scores = new ScoreRepository(documents);
      await scores.submitScore("space-test", "easy", {
        mode: "default",
        score: 100,
        initials: "AAA",
        timestamp: "2026-01-02T00:00:00.000Z",
      });
      await scores.submitScore("space-test", "easy", {
        mode: "default",
        score: 500,
        initials: "BBB",
        timestamp: "2026-01-03T00:00:00.000Z",
      });
      const { controller } = createController(documents);
      controller.chooseGame("space-test");
      await controller.openScores();
      assert(controller.snapshot.scores.length === 2, "two matching scores must render");
      assert(controller.snapshot.scores[0]?.score === 500, "scores must be highest first");
    },
  },
  {
    name: "corrupt settings recover to defaults and surface a warning",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      documents.setRaw("settings", "{ definitely not json");
      const { controller } = createController(documents);
      await controller.initialize();
      assert(controller.snapshot.settings.version === 1, "defaults must keep launcher usable");
      assert(
        controller.snapshot.warning?.includes("defaults were restored") === true,
        "corrupt settings recovery must be visible",
      );
    },
  },
];
