import { assert, type TestCase } from "../../test/harness.js";
import { calculateViewport, devicePhysicalSize } from "../render/viewport.js";
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
  {
    name: "CR2-003 a DPR-2 click on a 320x240 canvas still maps to the logical point it visually is",
    run: () => {
      // The trivial exact-fit case: a 320x240 CSS-pixel canvas is already an exact 1x multiple of
      // the 320x240 logical game, so this passes whether or not devicePixelRatio is threaded
      // through at all -- included because it is exactly what the task's acceptance criteria
      // names, but see the case below for one that actually distinguishes the fix from a no-op.
      const canvas = new FakeElement({ left: 0, top: 0, width: 320, height: 240 });
      const provider = new PointerInputProvider(() =>
        calculateViewport(
          { width: 320, height: 240 },
          {
            width: devicePhysicalSize(canvas.clientWidth, 2),
            height: devicePhysicalSize(canvas.clientHeight, 2),
          },
        ),
      );
      const adapter = new BrowserPointerAdapter(
        canvas as unknown as HTMLElement,
        provider,
        undefined,
        () => 2,
      );
      adapter.attach();
      canvas.dispatch("pointermove", { clientX: 160, clientY: 120 });
      const snapshot = provider.consumeFrame();
      assert(
        snapshot.position !== null &&
          Math.abs(snapshot.position.x - 160) < 1e-9 &&
          Math.abs(snapshot.position.y - 120) < 1e-9,
        `a click at the CSS-pixel center must still map to the logical center at DPR 2, got ${JSON.stringify(snapshot.position)}`,
      );
    },
  },
  {
    name: "CR2-003 pointer math and the render path must quantize the same integer scale, not merely each be correct alone",
    run: () => {
      // A CSS box (639x479) chosen so calculateViewport's integer floor lands on a *different*
      // whole number depending on whether the physical size fed to it is CSS pixels (the pre-fix
      // shape: floor(639/320)=1) or DPR-1.5 device pixels (the fixed shape: floor(959/320)=2) --
      // not merely a rounding-error-sized difference, a full extra step. A single physical pointer
      // click can therefore land inside the drawn game area under one shape and in the letterbox
      // border under the other, for the exact same on-screen position: the observable form of the
      // bug BrowserPointerAdapter's devicePixelRatio option exists to close.
      const dpr = 1.5;
      const canvas = new FakeElement({ left: 0, top: 0, width: 639, height: 479 });

      const fixedViewport = () =>
        calculateViewport(
          { width: 320, height: 240 },
          {
            width: devicePhysicalSize(canvas.clientWidth, dpr),
            height: devicePhysicalSize(canvas.clientHeight, dpr),
          },
        );
      assert(
        fixedViewport().scale === 2 && fixedViewport().integerScale,
        "fixture premise: the device-pixel viewport must resolve to an integer 2x scale",
      );
      const fixedProvider = new PointerInputProvider(fixedViewport);
      const fixedAdapter = new BrowserPointerAdapter(
        canvas as unknown as HTMLElement,
        fixedProvider,
        undefined,
        () => dpr,
      );
      fixedAdapter.attach();
      // A click 500 CSS-pixels in from the canvas's left edge -- inside the fixed viewport's
      // drawn game area (which spans device x in [159.5, 799.5], i.e. CSS-equivalent [106.3,
      // 533.0]), but past the pre-fix viewport's game area (CSS x in [159.5, 479.5]).
      canvas.dispatch("pointermove", { clientX: 500, clientY: 200 });
      const fixed = fixedProvider.consumeFrame();
      // Expected exactly: physical = (500, 200) CSS * 1.5 dpr = (750, 300) device pixels; viewport
      // offset (159.5, 119.5) at scale 2 -> logical ((750-159.5)/2, (300-119.5)/2) = (295.25,
      // 90.25). Pinned to this precise value, not just "non-null" -- a click landing inside the
      // game area but at the wrong logical position (e.g. because only the viewport's physical
      // size was fixed and not the click coordinate itself) would still pass a bare null-check.
      assert(
        fixed.position !== null &&
          Math.abs(fixed.position.x - 295.25) < 1e-9 &&
          Math.abs(fixed.position.y - 90.25) < 1e-9,
        `a click inside the drawn game area must resolve to the exact logical point it visually is, got ${JSON.stringify(fixed.position)}`,
      );

      // The pre-fix shape: viewport computed straight from CSS pixels (no device-pixel
      // conversion) and pointer physical coordinates left unscaled (devicePixelRatio omitted,
      // defaulting to 1) -- i.e. exactly what BrowserPointerAdapter did before this option
      // existed. Same physical click, same canvas.
      const cssOnlyViewport = () =>
        calculateViewport(
          { width: 320, height: 240 },
          { width: canvas.clientWidth, height: canvas.clientHeight },
        );
      assert(
        cssOnlyViewport().scale === 1,
        "fixture premise: the CSS-pixel-only viewport must floor to a different integer scale (1x) than the device-pixel one (2x)",
      );
      const buggyProvider = new PointerInputProvider(cssOnlyViewport);
      const buggyAdapter = new BrowserPointerAdapter(canvas as unknown as HTMLElement, buggyProvider);
      buggyAdapter.attach();
      canvas.dispatch("pointermove", { clientX: 500, clientY: 200 });
      const buggy = buggyProvider.consumeFrame();
      assert(
        buggy.position === null,
        "the pre-fix shape must read the identical physical click as missing the game entirely -- this is the disagreement the fix removes",
      );
    },
  },
];
