import type { GameModule } from "./contracts.js";
import { parseGameMetadata, type GameMetadata } from "./metadata.js";
import type { GameServices } from "./services.js";

interface RegisteredGame {
  readonly module: GameModule;
  readonly metadata: GameMetadata;
}

export class DuplicateGameIdError extends Error {
  public constructor(gameId: string) {
    super(`Game ID is already registered: ${gameId}`);
    this.name = "DuplicateGameIdError";
  }
}

export class UnknownGameIdError extends Error {
  public constructor(gameId: string) {
    super(`Unknown game ID: ${gameId}`);
    this.name = "UnknownGameIdError";
  }
}

export class GameRegistry {
  private readonly games = new Map<string, RegisteredGame>();

  public constructor(modules: readonly GameModule[] = []) {
    for (const module of modules) {
      this.register(module);
    }
  }

  public register(module: GameModule): void {
    const metadata = parseGameMetadata(module.metadata);
    if (this.games.has(metadata.id)) {
      throw new DuplicateGameIdError(metadata.id);
    }

    const create = (services: GameServices) => module.create(services);
    const resolveAssetUrl = module.resolveAssetUrl;
    const validatedModule: GameModule =
      resolveAssetUrl === undefined
        ? Object.freeze({ metadata, create })
        : Object.freeze({ metadata, create, resolveAssetUrl });

    this.games.set(metadata.id, { module: validatedModule, metadata });
  }

  public getModule(gameId: string): GameModule {
    const registered = this.games.get(gameId);
    if (registered === undefined) {
      throw new UnknownGameIdError(gameId);
    }
    return registered.module;
  }

  public listMetadata(): readonly GameMetadata[] {
    return [...this.games.values()]
      .map((registered) => registered.metadata)
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  public has(gameId: string): boolean {
    return this.games.has(gameId);
  }

  public get size(): number {
    return this.games.size;
  }
}
