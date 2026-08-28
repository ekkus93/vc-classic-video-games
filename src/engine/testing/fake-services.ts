import type {
  AssetService,
  AudioService,
  GameClock,
  GameLogger,
  GameServices,
  GameStorageService,
  InputService,
  RandomService,
  ScoreService,
  ScoreSubmission,
} from "../game/services.js";
import { XorShift32 } from "../random/xorshift32.js";

export class FakeInputService implements InputService {
  private readonly held = new Set<string>();

  public setHeld(player: number, action: string, held: boolean): void {
    const key = `${player}:${action}`;
    if (held) {
      this.held.add(key);
    } else {
      this.held.delete(key);
    }
  }

  public isHeld(player: number, action: string): boolean {
    return this.held.has(`${player}:${action}`);
  }
}

export class FakeAudioService implements AudioService {
  public readonly playedEffects: string[] = [];
  public stopAllCount = 0;

  public playEffect(assetId: string): void {
    this.playedEffects.push(assetId);
  }

  public stopAll(): void {
    this.stopAllCount += 1;
  }
}

export class FakeAssetService implements AssetService {
  public constructor(private readonly assetIds = new Set<string>()) {}

  public add(assetId: string): void {
    this.assetIds.add(assetId);
  }

  public has(assetId: string): boolean {
    return this.assetIds.has(assetId);
  }
}

export class FakeScoreService implements ScoreService {
  public readonly submissions: ScoreSubmission[] = [];

  public submit(submission: ScoreSubmission): Promise<void> {
    this.submissions.push(submission);
    return Promise.resolve();
  }
}

export class FakeGameStorageService implements GameStorageService {
  private readonly values = new Map<string, unknown>();

  public get<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.values.get(key) as T | undefined) ?? null);
  }

  public set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

export class SeededRandomService implements RandomService {
  private readonly rng: XorShift32;

  public constructor(seed: number) {
    this.rng = new XorShift32(seed);
  }

  public nextUint32(): number {
    return this.rng.nextUint32();
  }

  public nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }
}

export class FakeGameClock implements GameClock {
  private seconds = 0;

  public nowSeconds(): number {
    return this.seconds;
  }

  public set(seconds: number): void {
    this.seconds = seconds;
  }

  public advance(seconds: number): void {
    this.seconds += seconds;
  }
}

export interface FakeLogEntry {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly error?: unknown;
}

export class FakeGameLogger implements GameLogger {
  public readonly entries: FakeLogEntry[] = [];

  public debug(message: string): void {
    this.entries.push({ level: "debug", message });
  }

  public info(message: string): void {
    this.entries.push({ level: "info", message });
  }

  public warn(message: string): void {
    this.entries.push({ level: "warn", message });
  }

  public error(message: string, error?: unknown): void {
    this.entries.push(
      error === undefined
        ? { level: "error", message }
        : { level: "error", message, error },
    );
  }
}

export interface FakeGameServices extends GameServices {
  readonly input: FakeInputService;
  readonly audio: FakeAudioService;
  readonly assets: FakeAssetService;
  readonly scores: FakeScoreService;
  readonly storage: FakeGameStorageService;
  readonly rng: SeededRandomService;
  readonly clock: FakeGameClock;
  readonly logger: FakeGameLogger;
}

export function createFakeGameServices(seed = 1): FakeGameServices {
  return {
    input: new FakeInputService(),
    audio: new FakeAudioService(),
    assets: new FakeAssetService(),
    scores: new FakeScoreService(),
    storage: new FakeGameStorageService(),
    rng: new SeededRandomService(seed),
    clock: new FakeGameClock(),
    logger: new FakeGameLogger(),
  };
}
