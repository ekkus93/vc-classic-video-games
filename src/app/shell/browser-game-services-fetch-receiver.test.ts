import {
  MemoryJsonDocumentStore,
  type GameLogger,
  type GameModule,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { BrowserGameServices } from "./browser-game-services.js";
import { ShellGameInputBridge } from "./input-bridge.js";

class FakeGainNode {
  public gain = { value: 1 };
  public connect(): void {}
}

class FakeAudioBufferSourceNode {
  public buffer: unknown = null;
  public loop = false;
  public connect(): void {}
  public start(): void {}
  public stop(): void {}
  public addEventListener(): void {}
}

class FakeAudioContext {
  public state: "suspended" | "running" = "suspended";
  public readonly destination = Object.freeze({});

  public createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    return new FakeAudioBufferSourceNode();
  }

  public async resume(): Promise<void> {
    this.state = "running";
  }

  public async decodeAudioData(): Promise<never> {
    throw new Error("fixture error: empty manifest must not decode audio");
  }
}

const LOGGER: GameLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

const MODULE: GameModule = Object.freeze({
  metadata: Object.freeze({
    id: "fetch-receiver-fixture",
    title: "Fetch Receiver Fixture",
    description: "tests receiver-safe browser fetch",
    version: 1,
    players: [1],
    supportedInputs: ["keyboard"] as const,
    logicalWidth: 320,
    logicalHeight: 240,
    defaultDifficulty: "normal",
    difficulties: [{ id: "normal", label: "Normal" }],
    controls: [],
    assetManifest: "assets.json",
  }),
  resolveAssetUrl: (path: string) => `https://fixture/${path}`,
  create: () => {
    throw new Error("fixture error: create() must not run during service preload");
  },
});

const START_OPTIONS = Object.freeze({ players: 1, difficulty: "normal", seed: 1 });

export const tests: readonly TestCase[] = [
  {
    name: "default browser fetch preserves the Window/global receiver for WebKitGTK",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const calls: string[] = [];

      globalThis.fetch = function (
        this: typeof globalThis,
        input: RequestInfo | URL,
      ): Promise<Response> {
        assert(
          this === globalThis,
          "default fetch must call the browser fetch method with the global object as receiver",
        );
        calls.push(String(input));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ version: 1, assets: [] }),
        } as unknown as Response);
      };

      try {
        const context = new FakeAudioContext();
        const services = new BrowserGameServices(
          new MemoryJsonDocumentStore(),
          new ShellGameInputBridge(),
          LOGGER,
          () => {},
          undefined,
          () => context as unknown as AudioContext,
        );

        await services.create(MODULE, START_OPTIONS);

        assert(
          calls.length === 1 && calls[0] === "https://fixture/assets.json",
          `expected exactly one manifest request, got ${calls.join(", ")}`,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
];
