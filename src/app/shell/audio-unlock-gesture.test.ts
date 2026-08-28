import { assert, type TestCase } from "../../test/harness.js";
import { attachAudioUnlockGestures } from "./audio-unlock-gesture.js";

class CountingEventTarget implements EventTarget {
  private readonly listeners = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >();

  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
  ): void {
    if (callback === null) {
      return;
    }
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  public removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
  ): void {
    if (callback === null) {
      return;
    }
    this.listeners.get(type)?.delete(callback);
  }

  public dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) {
      if (typeof listener === "function") {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    }
    return true;
  }

  public count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export const tests: readonly TestCase[] = [
  {
    name: "P5/P7 trusted audio gesture unlock removes listeners after success",
    run: async () => {
      const keyboard = new CountingEventTarget();
      const pointer = new CountingEventTarget();
      let unlockCalls = 0;
      const detach = attachAudioUnlockGestures(keyboard, pointer, () => {
        unlockCalls += 1;
        return Promise.resolve(true);
      });

      assert(keyboard.count("keydown") === 1, "one keyboard unlock listener is required");
      assert(pointer.count("pointerdown") === 1, "one pointer unlock listener is required");

      keyboard.dispatchEvent(new Event("keydown"));
      await flushPromises();

      assert(unlockCalls === 1, "the trusted gesture must attempt audio unlock once");
      assert(
        Number(keyboard.count("keydown")) === 0 &&
          Number(pointer.count("pointerdown")) === 0,
        "successful unlock must remove both gesture listeners",
      );
      detach();
    },
  },
  {
    name: "P7-010 repeated audio gesture attachment and cleanup never accumulates listeners",
    run: () => {
      const keyboard = new CountingEventTarget();
      const pointer = new CountingEventTarget();

      for (let cycle = 0; cycle < 40; cycle += 1) {
        const detach = attachAudioUnlockGestures(keyboard, pointer, () =>
          Promise.resolve(false),
        );
        assert(
          keyboard.count("keydown") === 1 && pointer.count("pointerdown") === 1,
          "each mounted shell may own only one unlock listener per gesture target",
        );
        detach();
        assert(
          Number(keyboard.count("keydown")) === 0 &&
            Number(pointer.count("pointerdown")) === 0,
          "shell cleanup must remove every unlock gesture listener",
        );
      }
    },
  },
];
