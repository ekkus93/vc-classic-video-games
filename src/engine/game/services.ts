export interface InputService {
  isHeld(player: number, action: string): boolean;
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
