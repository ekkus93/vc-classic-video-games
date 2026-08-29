import type { InputService, LogicalAction, PointerSnapshot } from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellGameInputBridge } from "./input-bridge.js";

/**
 * Minimal fake `InputService` -- held/pressed/released are looked up from a caller-seeded map
 * keyed by `"player:action"`, defaulting to `false` for anything not seeded, and `pointer()`
 * returns a caller-settable snapshot. `resetCount` records how many times `reset()` was called,
 * distinguishing "reset propagated to this delegate" from "reset was a no-op here".
 */
class FakeInputService implements InputService {
  public resetCount = 0;
  private readonly heldKeys = new Set<string>();
  private pointerSnapshot: PointerSnapshot = {
    position: null,
    inside: false,
    primaryHeld: false,
    primaryPressed: false,
    primaryReleased: false,
  };

  public get pointer() {
    return { snapshot: () => this.pointerSnapshot };
  }

  public setPointer(snapshot: PointerSnapshot): void {
    this.pointerSnapshot = snapshot;
  }

  public setHeld(player: number, action: LogicalAction, held: boolean): void {
    const key = `${player}:${action}`;
    if (held) {
      this.heldKeys.add(key);
    } else {
      this.heldKeys.delete(key);
    }
  }

  public isHeld(player: number, action: LogicalAction): boolean {
    return this.heldKeys.has(`${player}:${action}`);
  }

  public wasPressed(player: number, action: LogicalAction): boolean {
    return this.isHeld(player, action);
  }

  public wasReleased(): boolean {
    return false;
  }

  public reset(): void {
    this.resetCount += 1;
  }
}

const NEUTRAL_POINTER = Object.freeze({
  position: null,
  inside: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
});

export const tests: readonly TestCase[] = [
  {
    name: "TC-004 an unattached bridge reports every action unheld and a neutral pointer",
    run: () => {
      const bridge = new ShellGameInputBridge();
      assert(!bridge.attached, "a fresh bridge must report unattached");
      assert(
        !bridge.isHeld(1, "up") && !bridge.wasPressed(1, "up") && !bridge.wasReleased(1, "up"),
        "an unattached bridge must report every action as not held/pressed/released",
      );
      assert(
        JSON.stringify(bridge.pointer.snapshot()) === JSON.stringify(NEUTRAL_POINTER),
        "an unattached bridge must expose the neutral fallback pointer snapshot",
      );
    },
  },
  {
    name: "TC-004 attach delegates every query to the attached input service",
    run: () => {
      const bridge = new ShellGameInputBridge();
      const fake = new FakeInputService();
      fake.setHeld(1, "action-1", true);
      fake.setPointer({
        position: { x: 12, y: 34 },
        inside: true,
        primaryHeld: true,
        primaryPressed: true,
        primaryReleased: false,
      });

      bridge.attach(fake);

      assert(bridge.attached, "attach must mark the bridge as attached");
      assert(bridge.isHeld(1, "action-1"), "isHeld must delegate to the attached service");
      assert(bridge.wasPressed(1, "action-1"), "wasPressed must delegate to the attached service");
      assert(
        bridge.pointer.snapshot().position?.x === 12 && bridge.pointer.snapshot().inside,
        "pointer must delegate to the attached service's own snapshot",
      );
    },
  },
  {
    name: "TC-004 detaching the currently attached service clears the delegate and resets the fallback pointer",
    run: () => {
      const bridge = new ShellGameInputBridge();
      const fake = new FakeInputService();
      fake.setHeld(1, "up", true);
      fake.setPointer({
        position: { x: 5, y: 5 },
        inside: true,
        primaryHeld: false,
        primaryPressed: false,
        primaryReleased: false,
      });
      bridge.attach(fake);

      bridge.detach(fake);

      assert(!bridge.attached, "detaching the current delegate must clear attachment");
      assert(
        !bridge.isHeld(1, "up"),
        "after detach, queries must fall back to the neutral state, not the old delegate's state",
      );
      assert(
        JSON.stringify(bridge.pointer.snapshot()) === JSON.stringify(NEUTRAL_POINTER),
        "detach must reset the fallback pointer to neutral, not leave it at the old delegate's last position",
      );
    },
  },
  {
    name: "TC-004 detaching a stale (no longer current) input service is a no-op",
    run: () => {
      const bridge = new ShellGameInputBridge();
      const stale = new FakeInputService();
      const current = new FakeInputService();
      current.setHeld(2, "right", true);

      bridge.attach(stale);
      bridge.attach(current);
      bridge.detach(stale);

      assert(
        bridge.attached,
        "detaching an instance that is no longer the current delegate must not clear attachment",
      );
      assert(
        bridge.isHeld(2, "right"),
        "the current delegate must remain in effect after a stale detach call",
      );
    },
  },
  {
    // Note: reset() also calls resetFallbackPointer() internally, but that call is not
    // independently verifiable -- the fallback pointer is only ever set to the same fixed
    // neutral snapshot (from here and from detach()), so nothing in this class can ever put it
    // in a non-neutral state for reset() to clear. Confirmed by mutation: removing the
    // resetFallbackPointer() call from reset() makes no test fail. Only the delegate-propagation
    // half of reset()'s contract is meaningfully testable.
    name: "TC-004 reset propagates to the attached delegate",
    run: () => {
      const bridge = new ShellGameInputBridge();
      const fake = new FakeInputService();
      bridge.attach(fake);

      bridge.reset();

      assert(fake.resetCount === 1, "reset() must propagate to the attached delegate exactly once");
    },
  },
];
