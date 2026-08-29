import {
  NamespacedGameStorageService,
  PersistentScoreService,
  ScoreRepository,
  SharedWebAudioService,
  parseAssetManifest,
  type AssetService,
  type AudioBufferResolver,
  type AudioContextFactory,
  type AudioLifecycleFailure,
  type GameLogger,
  type GameModule,
  type GameServices,
  type GameStartOptions,
  type JsonDocumentStore,
  type RecoveryWarning,
} from "../../engine/index.js";
import { SeededRandomService } from "../../engine/random/seeded-service.js";
import type { ShellGameInputBridge } from "./input-bridge.js";

/**
 * Structural shape `preload` needs from a `fetch` response -- a real `Response` satisfies this on
 * its own; tests supply a plain object instead. Narrower than `Response` (no `headers`, `body`,
 * etc.) so a fake never needs to implement browser API surface `preload` doesn't touch.
 */
export interface BrowserFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * `preload`'s own view of `fetch` -- the real global `fetch` satisfies this type as-is (a wider
 * function, accepting more input shapes and returning the full `Response`, can always stand in
 * for a narrower one), so production callers pass nothing and get real network behavior.
 */
export type BrowserFetch = (input: string) => Promise<BrowserFetchResponse>;

class BrowserGameAssetStore implements AssetService, AudioBufferResolver {
  private readonly values = new Map<string, unknown>();

  public clear(): void {
    this.values.clear();
  }

  public set(assetId: string, value: unknown): void {
    this.values.set(assetId, value);
  }

  public has(assetId: string): boolean {
    return this.values.has(assetId);
  }

  public get<T = unknown>(assetId: string): T | null {
    return (this.values.get(assetId) as T | undefined) ?? null;
  }

  public getAudioBuffer(assetId: string): AudioBuffer | null {
    return (this.values.get(assetId) as AudioBuffer | undefined) ?? null;
  }
}

export type GamePersistenceScope = "scores" | "game-state";

export interface GamePersistenceNotice {
  readonly scope: GamePersistenceScope;
  readonly gameId: string;
  readonly userMessage: string;
}

export type GamePersistenceReporter = (notice: GamePersistenceNotice) => void;


export class BrowserGameServices {
  private context: AudioContext | null = null;
  private readonly assets = new BrowserGameAssetStore();
  private readonly decodedAudio = new Map<string, AudioBuffer>();
  public readonly audio: SharedWebAudioService;

  public constructor(
    private readonly documents: JsonDocumentStore,
    private readonly input: ShellGameInputBridge,
    private readonly logger: GameLogger,
    private readonly reportPersistence: GamePersistenceReporter,
    private readonly fetchImpl: BrowserFetch = fetch,
    // The `typeof AudioContext === "undefined"` guard lives in this default rather than in
    // requireAudioContext() itself, so an injected test factory (which supplies its own fake and
    // never references the global) isn't blocked by it running in an environment -- this test
    // runner (Node, no jsdom) -- that has no such global at all.
    private readonly createAudioContext: AudioContextFactory = () => {
      if (typeof AudioContext === "undefined") {
        throw new Error("Web Audio is unavailable in this environment");
      }
      return new AudioContext();
    },
  ) {
    this.audio = new SharedWebAudioService(
      this.assets,
      () => this.requireAudioContext(),
      (failure) => this.reportAudioLifecycleFailure(failure),
    );
  }

  public async create(
    module: GameModule,
    options: GameStartOptions,
  ): Promise<GameServices> {
    // Launch originates from the user's activate gesture. Unlock before any
    // asynchronous asset work so Chromium can authorize the one shared context.
    await this.audio.unlock();
    await this.preload(module);

    const gameId = module.metadata.id;
    const reportRecovery = (warning: RecoveryWarning): void => {
      this.reportPersistenceEvent(
        warning.scope === "scores" ? "scores" : "game-state",
        gameId,
        warning.scope === "scores"
          ? "Some saved scores were invalid and were ignored."
          : `Saved state for ${module.metadata.title} was invalid and was ignored.`,
        warning.message,
      );
    };
    const scoreRepository = new ScoreRepository(this.documents, reportRecovery);
    return Object.freeze({
      input: this.input,
      audio: this.audio,
      assets: this.assets,
      scores: new PersistentScoreService(
        scoreRepository,
        gameId,
        () => options.difficulty,
        (error) => {
          this.reportPersistenceEvent(
            "scores",
            gameId,
            "Your score could not be saved.",
            `${module.metadata.title} score persistence failed`,
            error,
          );
        },
      ),
      storage: new NamespacedGameStorageService(
        this.documents,
        gameId,
        reportRecovery,
      ),
      rng: new SeededRandomService(options.seed),
      clock: Object.freeze({
        nowSeconds: () =>
          (typeof performance === "undefined" ? Date.now() : performance.now()) /
          1000,
      }),
      logger: this.logger,
    });
  }

  private reportAudioLifecycleFailure(failure: AudioLifecycleFailure): void {
    try {
      this.logger.error(`Web Audio ${failure.operation} failed`, failure.error);
    } catch {
      // Logging is the terminal diagnostic boundary for nonfatal audio lifecycle failure.
      // SharedWebAudioService already contains reporter failure, so this catch prevents a custom
      // logger from reintroducing an exception through the production reporter itself.
    }
  }

  private reportPersistenceEvent(
    scope: GamePersistenceScope,
    gameId: string,
    userMessage: string,
    diagnosticMessage: string,
    error?: unknown,
  ): void {
    try {
      if (error === undefined) {
        this.logger.warn(diagnosticMessage);
      } else {
        this.logger.error(diagnosticMessage, error);
      }
    } catch {
      // Diagnostic logging is already the final logging boundary. A broken logger must not turn a
      // recoverable persistence failure into a game failure or suppress the separate shell notice.
    }

    try {
      this.reportPersistence(Object.freeze({ scope, gameId, userMessage }));
    } catch (reportError) {
      try {
        this.logger.error("Game persistence warning reporter failed", reportError);
      } catch {
        // Both observability sinks are now broken. Swallowing here is intentional terminal
        // containment; recursing or escaping would crash gameplay while handling a save failure.
      }
    }
  }

  private requireAudioContext(): AudioContext {
    if (this.context !== null) {
      return this.context;
    }
    this.context = this.createAudioContext();
    return this.context;
  }

  private async preload(module: GameModule): Promise<void> {
    const resolveAssetUrl = module.resolveAssetUrl;
    if (resolveAssetUrl === undefined) {
      throw new Error(`${module.metadata.title} does not expose bundled asset URLs`);
    }
    const manifestUrl = resolveAssetUrl(module.metadata.assetManifest);
    if (manifestUrl === null) {
      throw new Error(
        `${module.metadata.title} cannot resolve ${module.metadata.assetManifest}`,
      );
    }

    const manifestResponse = await this.fetchImpl(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(
        `Could not load ${module.metadata.title} asset manifest: HTTP ${manifestResponse.status}`,
      );
    }
    const manifest = parseAssetManifest(await manifestResponse.json());
    const context = this.requireAudioContext();
    this.assets.clear();

    for (const entry of manifest.assets) {
      const url = resolveAssetUrl(entry.path);
      if (url === null) {
        if (entry.required) {
          throw new Error(`Required asset ${entry.id} has no bundled URL`);
        }
        continue;
      }
      if (entry.type !== "audio") {
        if (entry.required) {
          throw new Error(`Required asset ${entry.id} uses an unsupported browser loader`);
        }
        continue;
      }

      let buffer = this.decodedAudio.get(url);
      if (buffer === undefined) {
        const response = await this.fetchImpl(url);
        if (!response.ok) {
          if (entry.required) {
            throw new Error(`Required audio ${entry.id} failed: HTTP ${response.status}`);
          }
          continue;
        }
        buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.decodedAudio.set(url, buffer);
      }
      this.assets.set(entry.id, buffer);
    }
  }
}
