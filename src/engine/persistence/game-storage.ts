import type { GameStorageService } from "../game/services.js";
import type { JsonDocumentStore } from "./document-store.js";
import type { RecoveryReporter } from "./settings.js";

interface GameStateDocument {
  readonly version: 1;
  readonly values: Readonly<Record<string, unknown>>;
}

function validGameId(gameId: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/u.test(gameId);
}

function validKey(key: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(key);
}

export class NamespacedGameStorageService implements GameStorageService {
  public constructor(
    private readonly documents: JsonDocumentStore,
    private readonly gameId: string,
    private readonly reportRecovery: RecoveryReporter = () => undefined,
  ) {
    if (!validGameId(gameId)) {
      throw new Error("invalid game id for storage namespace");
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    this.assertKey(key);
    const document = await this.load();
    return (document.values[key] as T | undefined) ?? null;
  }

  public async set<T>(key: string, value: T): Promise<void> {
    this.assertKey(key);
    const document = await this.load();
    const next: GameStateDocument = {
      version: 1,
      values: { ...document.values, [key]: value },
    };
    await this.documents.save("game-state", JSON.stringify(next), this.gameId);
  }

  private async load(): Promise<GameStateDocument> {
    const raw = await this.documents.load("game-state", this.gameId);
    if (raw === null) {
      return { version: 1, values: {} };
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("document must be an object");
      }
      const record = parsed as Record<string, unknown>;
      if (record.version !== 1 || typeof record.values !== "object" || record.values === null || Array.isArray(record.values)) {
        throw new Error("game-state document version/values are invalid");
      }
      return { version: 1, values: record.values as Record<string, unknown> };
    } catch (error) {
      this.reportRecovery({
        scope: "game-state",
        message: `Stored state for ${this.gameId} was invalid and ignored: ${error instanceof Error ? error.message : String(error)}`,
      });
      return { version: 1, values: {} };
    }
  }

  private assertKey(key: string): void {
    if (!validKey(key)) {
      throw new Error("game storage key is invalid");
    }
  }
}
