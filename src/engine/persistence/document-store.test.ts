import { assert, type TestCase } from "../../test/harness.js";
import {
  TauriJsonDocumentStore,
  type TauriInvoke,
} from "./document-store.js";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

function assertCount(actual: number, expected: number, message: string): void {
  assert(actual === expected, message);
}

export const tests: readonly TestCase[] = [
  {
    name: "TauriJsonDocumentStore serializes saves to the same logical document",
    run: async () => {
      const first = deferred<void>();
      const second = deferred<void>();
      const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
      const invoke: TauriInvoke = (command, args) => {
        calls.push({ command, args });
        return (calls.length === 1 ? first.promise : second.promise) as Promise<never>;
      };
      const store = new TauriJsonDocumentStore(invoke);

      const saveA = store.save("settings", '{"version":1}');
      const saveB = store.save("settings", '{"version":2}');
      await flushMicrotasks();

      assertCount(calls.length, 1, "second same-key save must wait while the first is pending");
      assert(calls[0]?.command === "save_json_document", "save must invoke the native save command");
      assert(calls[0]?.args?.document === "settings", "first save must retain its document argument");
      assert(calls[0]?.args?.gameId === null, "unnamespaced save must send a null game id");
      assert(calls[0]?.args?.json === '{"version":1}', "first save must retain its JSON payload");

      first.resolve(undefined);
      await saveA;
      await flushMicrotasks();

      assertCount(calls.length, 2, "second same-key save must start after the first settles");
      assert(calls[1]?.args?.json === '{"version":2}', "queued save order must match invocation order");
      second.resolve(undefined);
      await saveB;
    },
  },
  {
    name: "TauriJsonDocumentStore continues a same-key queue after an earlier rejection",
    run: async () => {
      const first = deferred<void>();
      const second = deferred<void>();
      let calls = 0;
      const invoke: TauriInvoke = () => {
        calls += 1;
        return (calls === 1 ? first.promise : second.promise) as Promise<never>;
      };
      const store = new TauriJsonDocumentStore(invoke);

      const saveA = store.save("scores", "first");
      const saveB = store.save("scores", "second");
      await flushMicrotasks();
      assertCount(calls, 1, "later save must wait before the earlier rejection settles");

      first.reject(new Error("disk full"));
      let rejected = false;
      try {
        await saveA;
      } catch (error) {
        rejected = error instanceof Error && error.message === "disk full";
      }
      assert(rejected, "the failed save must still reject its own caller");
      await flushMicrotasks();
      assertCount(calls, 2, "a rejected save must not poison later work on the same key");

      second.resolve(undefined);
      await saveB;
    },
  },
  {
    name: "TauriJsonDocumentStore does not serialize independent logical documents",
    run: async () => {
      const pending = new Map<string, Deferred<void>>();
      const calls: string[] = [];
      const invoke: TauriInvoke = (_command, args) => {
        const key = `${String(args?.document)}:${String(args?.gameId)}`;
        calls.push(key);
        const gate = deferred<void>();
        pending.set(key, gate);
        return gate.promise as Promise<never>;
      };
      const store = new TauriJsonDocumentStore(invoke);

      const settings = store.save("settings", "settings");
      const gameState = store.save("game-state", "state", "space-rocks");
      await flushMicrotasks();

      assertCount(calls.length, 2, "independent keys must be allowed to start concurrently");
      assert(calls[0] === "settings:null", "settings key must invoke first");
      assert(calls[1] === "game-state:space-rocks", "game-state key must invoke independently");

      pending.get("settings:null")?.resolve(undefined);
      pending.get("game-state:space-rocks")?.resolve(undefined);
      await Promise.all([settings, gameState]);
    },
  },
  {
    name: "TauriJsonDocumentStore removes settled queue bookkeeping",
    run: async () => {
      const invoke: TauriInvoke = () => Promise.resolve(undefined) as Promise<never>;
      const store = new TauriJsonDocumentStore(invoke);
      await store.save("game-state", "state", "maze-chase");
      await flushMicrotasks();

      const internals = store as unknown as { readonly saveTails: Map<string, Promise<void>> };
      assert(internals.saveTails.size === 0, "settled per-key queue entries must be removed");
    },
  },
];
