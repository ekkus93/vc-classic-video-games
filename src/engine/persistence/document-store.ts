export type PersistenceDocument = "settings" | "scores" | "game-state";

export interface JsonDocumentStore {
  load(document: PersistenceDocument, gameId?: string): Promise<string | null>;
  save(document: PersistenceDocument, json: string, gameId?: string): Promise<void>;
}

export type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export class TauriJsonDocumentStore implements JsonDocumentStore {
  public constructor(private readonly invoke: TauriInvoke) {}

  public load(document: PersistenceDocument, gameId?: string): Promise<string | null> {
    return this.invoke<string | null>("load_json_document", {
      document,
      gameId: gameId ?? null,
    });
  }

  public save(
    document: PersistenceDocument,
    json: string,
    gameId?: string,
  ): Promise<void> {
    return this.invoke<void>("save_json_document", {
      document,
      gameId: gameId ?? null,
      json,
    });
  }
}

export class MemoryJsonDocumentStore implements JsonDocumentStore {
  private readonly documents = new Map<string, string>();

  public load(document: PersistenceDocument, gameId?: string): Promise<string | null> {
    return Promise.resolve(this.documents.get(this.key(document, gameId)) ?? null);
  }

  public save(
    document: PersistenceDocument,
    json: string,
    gameId?: string,
  ): Promise<void> {
    this.documents.set(this.key(document, gameId), json);
    return Promise.resolve();
  }

  public setRaw(document: PersistenceDocument, json: string, gameId?: string): void {
    this.documents.set(this.key(document, gameId), json);
  }

  private key(document: PersistenceDocument, gameId?: string): string {
    return `${document}:${gameId ?? ""}`;
  }
}
