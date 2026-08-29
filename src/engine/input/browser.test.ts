import { assert, type TestCase } from "../../test/harness.js";
import { BrowserPointerAdapter, PointerInputProvider } from "./pointer.js";

interface FakeRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Minimal `HTMLElement`-shaped fake covering only what `BrowserPointerAdapter` touches
 * (`addEventListener`/`removeEventListener`/`getBoundingClientRect`/`clientWidth`/`clientHeight`).
 * There is no real DOM in this test runner (Node, no jsdom), so this stands in for both the
 * shell's outer container and the game canvas, letting the fix be exercised without one.
 */
class FakeElement {
  private readonly listeners = new Map<string, (event: unknown) => void>();
  public constructor(private rect: FakeRect) {}
  public get clientWidth(): number {
    return this.rect.width;
  }
  public get clientHeight(): number {
    return this.rect.height;
  }
  public addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, listener);
  }
  public removeEventListener(type: string): void {
    this.listeners.delete(type);
  }
  public getBoundingClientRect(): DOMRect {
    return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height, x: this.rect.left, y: this.rect.top, toJSON: () => ({}) };
  }
  public dispatch(type: string, event: Partial<PointerEvent>): void {
    this.listeners.get(type)?.(event);
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "CR-004 pointer coordinates are measured against the bounds surface, not the listening surface",
    run: () => {
      // A padded outer shell (e.g. <main class="app-shell">) and, inside it, the actual visible
      // canvas box at a different screen position/size -- the exact shape of this app's layout.
      const shell = new FakeElement({ left: 0, top: 0, width: 400, height: 300 });
      const canvas = new FakeElement({ left: 60, top: 45, width: 320, height: 240 });

      // Same synthetic viewport() every case will see once bounds correctly resolve to the
      // canvas: physical box == logical box, 1:1 scale, no letterboxing.
      const canvasViewport = () => ({
        x: 0,
        y: 0,
        width: 320,
        height: 240,
        scale: 1,
        integerScale: true,
        logicalWidth: 320,
        logicalHeight: 240,
      });

      // CR-004 fix: bounds resolve to the canvas even though events are listened on the shell.
      const fixedProvider = new PointerInputProvider(canvasViewport);
      const fixedAdapter = new BrowserPointerAdapter(
        shell as unknown as HTMLElement,
        fixedProvider,
        () => canvas as unknown as HTMLElement,
      );
      fixedAdapter.attach();
      // Pointer is exactly at the canvas's visible top-left corner on screen.
      shell.dispatch("pointermove", { clientX: 60, clientY: 45 });
      const fixed = fixedProvider.consumeFrame();
      assert(
        fixed.inside && fixed.position !== null && Math.abs(fixed.position.x) < 1e-9 && Math.abs(fixed.position.y) < 1e-9,
        `pointer at the canvas's visible top-left corner must resolve to logical (0,0), got ${JSON.stringify(fixed.position)}`,
      );

      // Pre-fix shape: bounds default to the listening surface itself (the padded shell), which
      // is exactly what use-shell-input.ts did before CR-004 -- no boundsSurface concept, so
      // pointer math ran against the shell's own (larger, offset) box instead of the canvas's.
      const shellViewport = () => ({
        x: 40, // (shell.width 400 - scaled 320) / 2, mirroring calculateViewport's letterbox math
        y: 30, // (shell.height 300 - scaled 240) / 2
        width: 320,
        height: 240,
        scale: 1,
        integerScale: true,
        logicalWidth: 320,
        logicalHeight: 240,
      });
      const buggyProvider = new PointerInputProvider(shellViewport);
      const buggyAdapter = new BrowserPointerAdapter(shell as unknown as HTMLElement, buggyProvider);
      buggyAdapter.attach();
      shell.dispatch("pointermove", { clientX: 60, clientY: 45 });
      const buggy = buggyProvider.consumeFrame();
      assert(
        buggy.position !== null && (Math.abs(buggy.position.x) > 1 || Math.abs(buggy.position.y) > 1),
        "the pre-fix shape (bounds == listening surface) must misalign the same physical pointer position -- this proves the fix, not just the math",
      );
    },
  },
];
