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
  private readonly saveTails = new Map<string, Promise<void>>();

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
    const key = this.key(document, gameId);
    const previous = this.saveTails.get(key) ?? Promise.resolve();
    // `previous` is queue bookkeeping, not the prior caller's returned promise. Converting a
    // rejected tail to fulfillment here only lets the next invocation proceed; the failed save
    // still rejects its own `operation` to its original caller.
    const operation = previous
      .catch(() => undefined)
      .then(() =>
        this.invoke<void>("save_json_document", {
          document,
          gameId: gameId ?? null,
          json,
        }),
      );

    // The queue tail is deliberately fulfillment-only: a failed save must reject its own caller
    // without poisoning later saves for the same document. Cleanup is identity-checked so an older
    // completion cannot delete bookkeeping installed by a newer queued save.
    const tail = operation.then(
      () => undefined,
      () => undefined,
    );
    this.saveTails.set(key, tail);
    tail.then(() => {
      if (this.saveTails.get(key) === tail) {
        this.saveTails.delete(key);
      }
    });

    return operation;
  }

  private key(document: PersistenceDocument, gameId?: string): string {
    return `${document}:${gameId ?? ""}`;
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
