import {
  GameRegistry,
  MemoryJsonDocumentStore,
  ScoreRepository,
  defineGameMetadata,
  type GameModule,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellController } from "./controller.js";
import { buildLauncherHighScores } from "./launcher-scores.js";

function gameModule(id: string, title: string): GameModule {
  return {
    metadata: defineGameMetadata({
      id,
      title,
      description: `${title} launcher fixture`,
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
}

const host = {
  launch: () => Promise.resolve(),
  pause: () => undefined,
  resume: () => undefined,
  restart: () => Promise.resolve(),
  exit: () => undefined,
};

export const tests: readonly TestCase[] = [
  {
    name: "launcher high-score aggregation selects each registered game's best score",
    run: () => {
      const games = [gameModule("alpha", "Alpha"), gameModule("beta", "Beta")].map(
        (module) => module.metadata,
      );
      const highScores = buildLauncherHighScores(games, [
        {
          gameId: "alpha",
          mode: "default",
          difficulty: "normal",
          score: 100,
          initials: "AAA",
          timestamp: "2026-01-01T00:00:00.000Z",
          sequence: 0,
        },
        {
          gameId: "alpha",
          mode: "challenge",
          difficulty: "hard",
          score: 750,
          initials: "BBB",
          timestamp: "2026-01-02T00:00:00.000Z",
          sequence: 1,
        },
        {
          gameId: "not-registered",
          mode: "default",
          difficulty: "normal",
          score: 9999,
          initials: "ZZZ",
          timestamp: "2026-01-03T00:00:00.000Z",
          sequence: 2,
        },
      ]);

      assert(highScores.alpha === 750, "registered game must expose its best persisted score");
      assert(highScores.beta === null, "registered game without scores must expose an empty summary");
      assert(
        !("not-registered" in highScores),
        "score entries for unregistered games must not create launcher cards",
      );
    },
  },
  {
    name: "shell initialization hydrates launcher high scores from persistent score storage",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const scores = new ScoreRepository(documents);
      await scores.submitScore("alpha", "normal", {
        mode: "default",
        score: 125,
        initials: "AAA",
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      await scores.submitScore("alpha", "normal", {
        mode: "default",
        score: 900,
        initials: "BBB",
        timestamp: "2026-01-02T00:00:00.000Z",
      });

      const controller = new ShellController({
        registry: new GameRegistry([
          gameModule("alpha", "Alpha"),
          gameModule("beta", "Beta"),
        ]),
        documents,
        gameHost: host,
      });
      await controller.initialize();

      assert(
        controller.snapshot.launcherHighScores.alpha === 900,
        "launcher must hydrate the highest persisted score during startup",
      );
      assert(
        controller.snapshot.launcherHighScores.beta === null,
        "launcher must distinguish a registered game with no score yet",
      );
    },
  },
];
