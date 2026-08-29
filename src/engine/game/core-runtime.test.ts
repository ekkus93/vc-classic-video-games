import {
  ActiveGameRuntime,
  DuplicateGameIdError,
  GameLifecycle,
  GameMetadataValidationError,
  GameRegistry,
  InvalidLifecycleTransitionError,
  defineGameMetadata,
  parseGameMetadata,
  type GameInstance,
  type GameMetadata,
  type GameModule,
  type GameServices,
  type GameStartOptions,
} from "../index.js";
import { createFakeGameServices } from "../testing/fake-services.js";
import { FakeGameRenderer } from "../testing/fake-renderer.js";
import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";

const START_OPTIONS: GameStartOptions = {
  players: 1,
  difficulty: "normal",
  seed: 1234,
};
const RENDERER = new FakeGameRenderer();

function hasRuntimeState(runtime: ActiveGameRuntime, expected: string): boolean {
  return runtime.state === expected;
}

function metadata(id: string, title = id): GameMetadata {
  return defineGameMetadata({
    id,
    title,
    description: `Test game ${title}`,
    version: 1,
    players: [1, 2],
    supportedInputs: ["keyboard", "gamepad"],
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "normal",
    difficulties: [{ id: "normal", label: "Normal" }],
    controls: [{ action: "action-1", label: "Action" }],
    assetManifest: `games/${id}/assets.json`,
  });
}

function expectThrows<T extends Error>(
  operation: () => void,
  errorType: new (...args: never[]) => T,
  message: string,
): void {
  let thrown: unknown = null;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof errorType, message);
}

interface DummyOptions {
  readonly throwOnUpdate?: boolean;
  readonly captureServices?: (services: GameServices) => void;
}

function dummyModule(
  id: string,
  events: string[],
  options: DummyOptions = {},
): GameModule {
  return {
    metadata: metadata(id),
    create: (services) => {
      options.captureServices?.(services);
      events.push(`${id}:create`);

      const instance: GameInstance = {
        start: (startOptions) => {
          events.push(`${id}:start:${startOptions.difficulty}`);
        },
        update: (dtSeconds) => {
          events.push(`${id}:update:${dtSeconds}`);
          if (options.throwOnUpdate === true) {
            throw new Error(`${id} update failed`);
          }
        },
        render: (renderer) => {
          events.push(`${id}:render:${renderer.logicalWidth}`);
        },
        pause: () => {
          events.push(`${id}:pause`);
        },
        resume: () => {
          events.push(`${id}:resume`);
        },
        reset: () => {
          events.push(`${id}:reset`);
        },
        destroy: () => {
          events.push(`${id}:destroy`);
        },
      };
      return instance;
    },
  };
}

export const tests: readonly TestCase[] = [
  {
    name: "metadata parser accepts canonical metadata and rejects malformed input",
    run: () => {
      const parsed = metadata("test-game", "Test Game");
      assert(parsed.id === "test-game", "canonical metadata must parse");
      assert(Object.isFrozen(parsed), "parsed metadata must be immutable");

      expectThrows(
        () =>
          parseGameMetadata({
            ...parsed,
            id: "Not Canonical",
          }),
        GameMetadataValidationError,
        "invalid game IDs must be rejected",
      );
      expectThrows(
        () =>
          parseGameMetadata({
            ...parsed,
            defaultDifficulty: "missing",
          }),
        GameMetadataValidationError,
        "missing default difficulty references must be rejected",
      );
    },
  },
  {
    name: "CR-011/P2-001 metadata parser rejects duplicate players, inputs, and difficulties",
    run: () => {
      const parsed = metadata("test-game", "Test Game");

      expectThrows(
        () => parseGameMetadata({ ...parsed, players: [1, 1] }),
        GameMetadataValidationError,
        "duplicate player counts must be rejected",
      );
      expectThrows(
        () =>
          parseGameMetadata({
            ...parsed,
            supportedInputs: ["keyboard", "keyboard"],
          }),
        GameMetadataValidationError,
        "duplicate supported input kinds must be rejected",
      );
      expectThrows(
        () =>
          parseGameMetadata({
            ...parsed,
            difficulties: [
              { id: "normal", label: "Normal" },
              { id: "normal", label: "Normal Again" },
            ],
          }),
        GameMetadataValidationError,
        "duplicate difficulty IDs must be rejected",
      );
    },
  },
  {
    name: "registry validates modules, rejects duplicate IDs, and enumerates metadata",
    run: () => {
      const events: string[] = [];
      const alpha = dummyModule("alpha", events);
      const beta = dummyModule("beta", events);
      const registry = new GameRegistry([beta, alpha]);

      assertDeepEqual(
        registry.listMetadata().map((entry) => entry.id),
        ["alpha", "beta"],
        "launcher-facing registry metadata must be deterministic",
      );
      assert(
        registry.getModule("alpha").metadata === registry.listMetadata()[0],
        "registry modules must expose the validated immutable metadata snapshot",
      );
      const resolverModule: GameModule = {
        ...dummyModule("assets", events),
        resolveAssetUrl: (path) => `bundle://${path}`,
      };
      registry.register(resolverModule);
      assert(
        registry.getModule("assets").resolveAssetUrl?.("audio/test.wav") ===
          "bundle://audio/test.wav",
        "registry validation must preserve bundled asset URL resolution",
      );
      expectThrows(
        () => registry.register(dummyModule("alpha", events)),
        DuplicateGameIdError,
        "duplicate game IDs must fail registration",
      );
    },
  },
  {
    name: "lifecycle state machine permits canonical flow and rejects illegal jumps",
    run: () => {
      const lifecycle = new GameLifecycle();
      lifecycle.transition("loading");
      lifecycle.transition("ready");
      lifecycle.transition("running");
      lifecycle.transition("paused");
      lifecycle.transition("running");
      lifecycle.transition("game-over");
      lifecycle.transition("ready");
      lifecycle.transition("unloaded");
      assert(lifecycle.state === "unloaded", "canonical lifecycle must complete");

      expectThrows(
        () => lifecycle.transition("running"),
        InvalidLifecycleTransitionError,
        "unloaded games must not jump directly to running",
      );
    },
  },
  {
    name: "active runtime drives complete public lifecycle with injected services",
    run: async () => {
      const events: string[] = [];
      const services = createFakeGameServices(7);
      let receivedServices: GameServices | null = null;
      const runtime = new ActiveGameRuntime(services);
      const module = dummyModule("lifecycle-game", events, {
        captureServices: (injected) => {
          receivedServices = injected;
        },
      });

      await runtime.load(module);
      assert(receivedServices === services, "module must receive injected services");
      await runtime.start(START_OPTIONS);
      runtime.update(0.25);
      runtime.render(RENDERER);
      runtime.pause();
      runtime.render(RENDERER);
      runtime.resume();
      runtime.markGameOver();
      runtime.reset();
      runtime.destroy();

      assertDeepEqual(
        events,
        [
          "lifecycle-game:create",
          "lifecycle-game:start:normal",
          "lifecycle-game:update:0.25",
          "lifecycle-game:render:320",
          "lifecycle-game:pause",
          "lifecycle-game:render:320",
          "lifecycle-game:resume",
          "lifecycle-game:reset",
          "lifecycle-game:destroy",
        ],
        "runtime must route lifecycle operations through the public game API",
      );
      assert(runtime.state === "unloaded", "destroy must release runtime state");
      assert(runtime.activeGameId === null, "destroy must release active ownership");
    },
  },
  {
    name: "loading a replacement destroys the previous active game first",
    run: async () => {
      const events: string[] = [];
      const services = createFakeGameServices(9);
      const runtime = new ActiveGameRuntime(services);

      await runtime.load(dummyModule("first-game", events));
      await runtime.load(dummyModule("second-game", events));

      assertDeepEqual(
        events,
        ["first-game:create", "first-game:destroy", "second-game:create"],
        "replacement must release prior ownership before creating next game",
      );
      assert(runtime.activeGameId === "second-game", "only replacement may remain active");
      assert(services.audio.stopAllCount === 1, "replacement must stop prior game audio");
    },
  },
  {
    name: "game failure is isolated and runtime can recover for another game",
    run: async () => {
      const events: string[] = [];
      const failures: string[] = [];
      const services = createFakeGameServices(11);
      const runtime = new ActiveGameRuntime(services, (event) => {
        failures.push(`${event.phase}:${event.gameId ?? "none"}`);
      });

      await runtime.load(
        dummyModule("broken-game", events, { throwOnUpdate: true }),
      );
      await runtime.start(START_OPTIONS);
      runtime.update(1 / 60);

      assert(
        hasRuntimeState(runtime, "error"),
        "failing update must isolate runtime in error state",
      );
      assert(runtime.activeGameId === null, "failing game ownership must be released");
      assertDeepEqual(
        failures,
        ["update:broken-game"],
        "runtime must report the failing phase",
      );

      runtime.recover();
      await runtime.load(dummyModule("healthy-game", events));
      assert(
        hasRuntimeState(runtime, "ready"),
        "runtime must load a healthy game after recovery",
      );
      assert(runtime.activeGameId === "healthy-game", "healthy game must acquire ownership");
    },
  },
  {
    name: "fake services provide deterministic clock, RNG, input, and storage",
    run: async () => {
      const first = createFakeGameServices(0x1234);
      const second = createFakeGameServices(0x1234);
      assertDeepEqual(
        [first.rng.nextUint32(), first.rng.nextUint32()],
        [second.rng.nextUint32(), second.rng.nextUint32()],
        "fake RNG must be reproducible",
      );

      first.clock.advance(2.5);
      assert(first.clock.nowSeconds() === 2.5, "fake clock must advance deterministically");
      first.input.setHeld(1, "action-1", true);
      assert(first.input.isHeld(1, "action-1"), "fake input state must be controllable");
      await first.storage.set("checkpoint", { wave: 3 });
      const stored = await first.storage.get<{ wave: number }>("checkpoint");
      assert(stored?.wave === 3, "fake storage must round-trip values");
    },
  },
];
