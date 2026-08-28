import type { LogicalAction } from "../input/actions.js";
import { StaticPointerInputService } from "../input/pointer.js";
import { XorShift32 } from "../random/xorshift32.js";
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

export class FakeInputService implements InputService {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();
  public readonly pointer = new StaticPointerInputService();

  public setHeld(player: number, action: LogicalAction, held: boolean): void {
    const key = `${player}:${action}`;
    const wasHeld = this.held.has(key);
    if (held) {
      this.held.add(key);
      if (!wasHeld) {
        this.pressed.add(key);
      }
    } else {
      this.held.delete(key);
      if (wasHeld) {
        this.released.add(key);
      }
    }
  }

  public isHeld(player: number, action: LogicalAction): boolean {
    return this.held.has(`${player}:${action}`);
  }

  public wasPressed(player: number, action: LogicalAction): boolean {
    return this.pressed.has(`${player}:${action}`);
  }

  public wasReleased(player: number, action: LogicalAction): boolean {
    return this.released.has(`${player}:${action}`);
  }

  public clearEdges(): void {
    this.pressed.clear();
    this.released.clear();
  }

  public reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.pointer.set({
      position: null,
      inside: false,
      primaryHeld: false,
      primaryPressed: false,
      primaryReleased: false,
    });
  }
}

export class FakeAudioService implements AudioService {
  public readonly playedEffects: string[] = [];
  public readonly playedLoops: string[] = [];
  public readonly stopped: string[] = [];
  private readonly active = new Set<string>();
  public stopAllCount = 0;
  public pauseAllCount = 0;
  public resumeAllCount = 0;

  public playEffect(assetId: string): void {
    this.playedEffects.push(assetId);
    this.active.add(assetId);
  }

  public playLoop(assetId: string): void {
    this.playedLoops.push(assetId);
    this.active.add(assetId);
  }

  public stop(assetId: string): void {
    this.stopped.push(assetId);
    this.active.delete(assetId);
  }

  public pauseAll(): void {
    this.pauseAllCount += 1;
  }

  public resumeAll(): void {
    this.resumeAllCount += 1;
  }

  public stopAll(): void {
    this.stopAllCount += 1;
    this.active.clear();
  }

  public isActive(assetId: string): boolean {
    return this.active.has(assetId);
  }

  public get activeCount(): number {
    return this.active.size;
  }
}

export class FakeAssetService implements AssetService {
  private readonly values = new Map<string, unknown>();

  public constructor(assetIds = new Set<string>()) {
    for (const id of assetIds) {
      this.values.set(id, true);
    }
  }

  public add(assetId: string, value: unknown = true): void {
    this.values.set(assetId, value);
  }

  public has(assetId: string): boolean {
    return this.values.has(assetId);
  }

  public get<T = unknown>(assetId: string): T | null {
    return (this.values.get(assetId) as T | undefined) ?? null;
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
