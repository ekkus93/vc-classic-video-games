import type { GameMetadata } from "./metadata.js";
import type { GameServices } from "./services.js";
import type { GameRenderer } from "../render/renderer.js";

export type { GameRenderer } from "../render/renderer.js";

export interface GameStartOptions {
  readonly players: number;
  readonly difficulty: string;
  readonly seed: number;
}

export interface GameInstance {
  start(options: GameStartOptions): void | Promise<void>;
  update(dtSeconds: number): void;
  render(renderer: GameRenderer): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
}

export interface GameModule {
  readonly metadata: GameMetadata;
  create(services: GameServices): GameInstance;
}
