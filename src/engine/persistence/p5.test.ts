import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { AssetCache, RequiredAssetLoadError } from "../assets/asset-service.js";
import { AssetManifestValidationError, parseAssetManifest } from "../assets/manifest.js";
import { MemoryJsonDocumentStore } from "./document-store.js";
import {
  GlobalSettingsRepository,
  PersistentInputSettingsStore,
  createDefaultGlobalSettings,
  parseGlobalSettings,
} from "./settings.js";
import { NamespacedGameStorageService } from "./game-storage.js";
import { ScoreRepository } from "../scores/scores.js";

function expectThrows(operation: () => unknown, type: new (...args: never[]) => Error): void {
  let thrown: unknown = null;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof type, `expected ${type.name}`);
}

export const tests: readonly TestCase[] = [
  {
    name: "asset manifest rejects duplicate IDs and malformed entries",
    run: () => {
      expectThrows(
        () => parseAssetManifest({
          version: 1,
          assets: [
            { id: "ship", path: "ship.png", type: "image" },
            { id: "ship", path: "ship2.png", type: "image" },
          ],
        }),
        AssetManifestValidationError,
      );
    },
  },
  {
    name: "asset cache preloads required data and reports missing required assets",
    run: async () => {
      const cache = new AssetCache(async (path) => ({
        ok: path !== "missing.png",
        status: path === "missing.png" ? 404 : 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        json: async () => ({ wave: 1 }),
      }));
      await cache.preload({
        version: 1,
        assets: [{ id: "level", path: "level.json", type: "json" }],
      });
      assert(cache.has("level"), "preloaded asset must be cached");
      assert(
        cache.get<{ wave: number }>("level")?.wave === 1,
        "JSON asset must retain parsed value",
      );

      let thrown: unknown = null;
      try {
        await cache.preload({
          version: 1,
          assets: [{ id: "missing", path: "missing.png", type: "image" }],
        });
      } catch (error) {
        thrown = error;
      }
      assert(
        thrown instanceof RequiredAssetLoadError,
        "missing required asset must fail recoverably",
      );
    },
  },
  {
    name: "settings validate ranges and recover from corrupt persisted JSON",
    run: async () => {
      const defaults = createDefaultGlobalSettings();
      assert(
        parseGlobalSettings(defaults).audio.masterVolume === 1,
        "defaults must validate",
      );
      expectThrows(
        () => parseGlobalSettings({
          ...defaults,
          audio: { ...defaults.audio, masterVolume: 2 },
        }),
        Error,
      );
      const documents = new MemoryJsonDocumentStore();
      documents.setRaw("settings", "{not-json");
      const warnings: string[] = [];
      const repository = new GlobalSettingsRepository(documents, (warning) =>
        warnings.push(warning.message),
      );
      assert(
        (await repository.load()).version === 1,
        "corrupt settings must fall back to defaults",
      );
      assert(warnings.length === 1, "corrupt settings must emit one recovery warning");
    },
  },
  {
    name: "P4 input mappings persist through the P5 global settings boundary",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const repository = new GlobalSettingsRepository(documents);
      const store = new PersistentInputSettingsStore(repository);
      const defaults = createDefaultGlobalSettings().input;
      await store.save(defaults);
      const restartedStore = new PersistentInputSettingsStore(
        new GlobalSettingsRepository(documents),
      );
      const loaded = await restartedStore.load();
      assert(
        JSON.stringify(loaded) === JSON.stringify(defaults),
        "input settings must survive repository recreation",
      );
    },
  },
  {
    name: "scores sort deterministically by score, timestamp, then insertion sequence",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const scores = new ScoreRepository(documents);
      await scores.submitScore("space-rocks", "normal", {
        score: 100,
        mode: "solo",
        initials: "bbb",
        timestamp: "2026-01-02T00:00:00.000Z",
      });
      await scores.submitScore("space-rocks", "normal", {
        score: 200,
        mode: "solo",
        initials: "aaa",
        timestamp: "2026-01-03T00:00:00.000Z",
      });
      await scores.submitScore("space-rocks", "normal", {
        score: 200,
        mode: "solo",
        initials: "ccc",
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      const top = await scores.queryScores("space-rocks", "solo", "normal");
      assertDeepEqual(
        top.map((entry) => entry.initials),
        ["CCC", "AAA", "BBB"],
        "score ordering must be deterministic",
      );
    },
  },
  {
    name: "per-game storage namespaces prevent one game from overwriting another",
    run: async () => {
      const documents = new MemoryJsonDocumentStore();
      const a = new NamespacedGameStorageService(documents, "game-a");
      const b = new NamespacedGameStorageService(documents, "game-b");
      await a.set("checkpoint", { wave: 4 });
      await b.set("checkpoint", { wave: 9 });
      assert(
        (await a.get<{ wave: number }>("checkpoint"))?.wave === 4,
        "game A state must stay isolated",
      );
      assert(
        (await b.get<{ wave: number }>("checkpoint"))?.wave === 9,
        "game B state must stay isolated",
      );
    },
  },
];
