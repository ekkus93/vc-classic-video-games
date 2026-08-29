import {
  MemoryJsonDocumentStore,
  type GameMetadata,
  type GameModule,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import {
  BrowserGameServices,
  type BrowserFetch,
  type BrowserFetchResponse,
} from "./browser-game-services.js";
import { ShellGameInputBridge } from "./input-bridge.js";

/**
 * Minimal fakes for the Web Audio surface `BrowserGameServices` and the `SharedWebAudioService`
 * it owns actually call -- `createGain`, `createBufferSource`, `destination`, `state`, `resume`,
 * and (for `preload`'s own use) `decodeAudioData`. Cast to the real DOM `AudioContext` type at
 * the point it crosses into production code, the same escape hatch `audio-service.test.ts` uses
 * for the same reason: there is no jsdom here, and the real interfaces are enormous.
 */
class FakeGainNode {
  public gain = { value: 1 };
  public connect(): void {
    /* no-op */
  }
}

class FakeAudioBufferSourceNode {
  public buffer: unknown = null;
  public loop = false;
  public connect(): void {
    /* no-op */
  }
  public start(): void {
    /* no-op */
  }
  public stop(): void {
    /* no-op */
  }
  public addEventListener(): void {
    /* no-op */
  }
}

class FakeAudioContext {
  public state: "suspended" | "running" = "suspended";
  public readonly destination = Object.freeze({});
  public readonly decodedBuffers: ArrayBuffer[] = [];

  public createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    return new FakeAudioBufferSourceNode();
  }

  public async resume(): Promise<void> {
    this.state = "running";
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<unknown> {
    this.decodedBuffers.push(data);
    return Object.freeze({ fakeBuffer: true, byteLength: data.byteLength });
  }
}

/** Records every URL requested and dispatches to a per-URL handler the test registers. */
class FakeFetch {
  public readonly calls: string[] = [];
  private readonly handlers = new Map<string, () => BrowserFetchResponse>();

  public on(url: string, handler: () => BrowserFetchResponse): void {
    this.handlers.set(url, handler);
  }

  public readonly fetch: BrowserFetch = (url: string) => {
    this.calls.push(url);
    const handler = this.handlers.get(url);
    if (handler === undefined) {
      throw new Error(`fixture error: no fetch handler registered for ${url}`);
    }
    return Promise.resolve(handler());
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): BrowserFetchResponse {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  };
}

function audioResponse(ok = true, status = 200): BrowserFetchResponse {
  return {
    ok,
    status,
    json: () => Promise.reject(new Error("fixture error: json() should not be called for audio")),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  };
}

function fakeMetadata(overrides: Partial<GameMetadata> = {}): GameMetadata {
  return {
    id: "fixture-game",
    title: "Fixture Game",
    description: "a fixture game for preload tests",
    version: 1,
    players: [1],
    supportedInputs: ["keyboard"],
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "normal",
    difficulties: [{ id: "normal", label: "Normal" }],
    controls: [],
    assetManifest: "assets.json",
    ...overrides,
  };
}

function fakeModule(
  resolveAssetUrl: ((path: string) => string | null) | undefined,
  overrides: Partial<GameMetadata> = {},
): GameModule {
  const create = (): never => {
    throw new Error("fixture error: create() must not be called by a preload-only test");
  };
  return resolveAssetUrl === undefined
    ? { metadata: fakeMetadata(overrides), create }
    : { metadata: fakeMetadata(overrides), create, resolveAssetUrl };
}

function harness() {
  const fetchFake = new FakeFetch();
  const contexts: FakeAudioContext[] = [];
  const services = new BrowserGameServices(
    new MemoryJsonDocumentStore(),
    new ShellGameInputBridge(),
    fetchFake.fetch,
    () => {
      const context = new FakeAudioContext();
      contexts.push(context);
      return context as unknown as AudioContext;
    },
  );
  return {
    services,
    fetchFake,
    context: () => {
      const current = contexts[contexts.length - 1];
      if (current === undefined) {
        throw new Error("fixture error: no AudioContext has been created yet");
      }
      return current;
    },
  };
}

const START_OPTIONS = Object.freeze({ players: 1, difficulty: "normal", seed: 1 });

async function expectRejection(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
  }
  throw new Error("fixture error: expected action to reject with an Error");
}

export const tests: readonly TestCase[] = [
  {
    name: "TC-003 preload throws naming the module when it exposes no resolveAssetUrl",
    run: async () => {
      const { services } = harness();
      const module = fakeModule(undefined, { title: "No Assets Game" });
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("No Assets Game"),
        `expected the module's title in the error, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 preload throws naming the manifest path when it cannot be resolved",
    run: async () => {
      const { services } = harness();
      const module = fakeModule(() => null, { assetManifest: "assets.json" });
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("assets.json"),
        `expected the unresolvable manifest path in the error, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 preload throws with the HTTP status when the manifest fetch is not ok",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule(() => "https://fixture/assets.json");
      fetchFake.on("https://fixture/assets.json", () => jsonResponse(null, false, 503));
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("503"),
        `expected the manifest fetch's HTTP status in the error, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 preload throws naming a required asset with no bundled URL",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/assets.json" : null,
      );
      fetchFake.on("https://fixture/assets.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "req-1", path: "audio/x.wav", type: "audio", required: true }],
        }),
      );
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("req-1"),
        `expected the unresolvable required asset's id in the error, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 preload throws naming a required non-audio asset as an unsupported loader",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/assets.json" : `https://fixture/${path}`,
      );
      fetchFake.on("https://fixture/assets.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "req-sprite", path: "sprite.png", type: "image", required: true }],
        }),
      );
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("req-sprite") && error.message.includes("unsupported"),
        `expected an unsupported-loader error naming req-sprite, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 preload silently skips an optional asset with no bundled URL",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) => (path === "assets.json" ? "https://fixture/m.json" : null));
      fetchFake.on("https://fixture/m.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "opt-1", path: "audio/missing.wav", type: "audio", required: false }],
        }),
      );
      const result = await services.create(module, START_OPTIONS);
      assert(!result.assets.has("opt-1"), "an optional unresolvable asset must be skipped, not throw");
    },
  },
  {
    name: "TC-003 preload silently skips an optional asset whose fetch fails",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/m.json" : "https://fixture/opt.wav",
      );
      fetchFake.on("https://fixture/m.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "opt-2", path: "audio/opt.wav", type: "audio", required: false }],
        }),
      );
      fetchFake.on("https://fixture/opt.wav", () => audioResponse(false, 404));
      const result = await services.create(module, START_OPTIONS);
      assert(
        !result.assets.has("opt-2"),
        "an optional asset whose fetch fails must be skipped, not throw",
      );
    },
  },
  {
    name: "TC-003 preload throws naming a required asset whose audio fetch fails, with the HTTP status",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/m.json" : "https://fixture/req.wav",
      );
      fetchFake.on("https://fixture/m.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "req-audio", path: "audio/req.wav", type: "audio", required: true }],
        }),
      );
      fetchFake.on("https://fixture/req.wav", () => audioResponse(false, 500));
      const error = await expectRejection(() => services.create(module, START_OPTIONS));
      assert(
        error.message.includes("req-audio") && error.message.includes("500"),
        `expected the failing required asset's id and HTTP status, got: ${error.message}`,
      );
    },
  },
  {
    name: "TC-003 two manifest entries resolving to the same URL decode audio only once",
    run: async () => {
      const { services, fetchFake, context } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/m.json" : "https://fixture/shared.wav",
      );
      fetchFake.on("https://fixture/m.json", () =>
        jsonResponse({
          version: 1,
          assets: [
            { id: "shared-a", path: "audio/shared.wav", type: "audio", required: true },
            { id: "shared-b", path: "audio/shared.wav", type: "audio", required: true },
          ],
        }),
      );
      fetchFake.on("https://fixture/shared.wav", () => audioResponse());

      const result = await services.create(module, START_OPTIONS);

      const fetchCount = fetchFake.calls.filter((url) => url === "https://fixture/shared.wav").length;
      assert(fetchCount === 1, `expected exactly one fetch of the shared URL, got ${fetchCount}`);
      assert(
        context().decodedBuffers.length === 1,
        `expected exactly one decodeAudioData call, got ${context().decodedBuffers.length}`,
      );
      assert(
        result.assets.has("shared-a") && result.assets.has("shared-b"),
        "both asset ids sharing the URL must end up mapped to a buffer",
      );
    },
  },
  {
    name: "TC-003 a successful create assembles GameServices whose assets reflect the loaded manifest",
    run: async () => {
      const { services, fetchFake } = harness();
      const module = fakeModule((path) =>
        path === "assets.json" ? "https://fixture/m.json" : "https://fixture/one.wav",
      );
      fetchFake.on("https://fixture/m.json", () =>
        jsonResponse({
          version: 1,
          assets: [{ id: "one", path: "audio/one.wav", type: "audio", required: true }],
        }),
      );
      fetchFake.on("https://fixture/one.wav", () => audioResponse());

      const result = await services.create(module, START_OPTIONS);

      assert(result.assets.has("one"), "the loaded asset must be present in the assembled services");
      assert(result.audio !== undefined, "the assembled services must expose the shared audio service");
    },
  },
];
