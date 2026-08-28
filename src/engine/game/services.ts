import type { LogicalAction } from "../input/actions.js";
import type { PointerInputService } from "../input/pointer.js";

export interface InputService {
  readonly pointer: PointerInputService;
  isHeld(player: number, action: LogicalAction): boolean;
  wasPressed(player: number, action: LogicalAction): boolean;
  wasReleased(player: number, action: LogicalAction): boolean;
}

export interface AudioService {
  playEffect(assetId: string): void;
  stopAll(): void;
}

export interface AssetService {
  has(assetId: string): boolean;
}

export interface ScoreSubmission {
  readonly score: number;
  readonly mode: string;
}

export interface ScoreService {
  submit(submission: ScoreSubmission): Promise<void>;
}

export interface GameStorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface RandomService {
  nextUint32(): number;
  nextFloat(): number;
}

export interface GameClock {
  nowSeconds(): number;
}

export interface GameLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error?: unknown): void;
}

export interface GameServices {
  readonly input: InputService;
  readonly audio: AudioService;
  readonly assets: AssetService;
  readonly scores: ScoreService;
  readonly storage: GameStorageService;
  readonly rng: RandomService;
  readonly clock: GameClock;
  readonly logger: GameLogger;
}
