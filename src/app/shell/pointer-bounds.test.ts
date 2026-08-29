import { assert, type TestCase } from "../../test/harness.js";
import { createPointerBoundsResolver, type PointerBoundsElement } from "./pointer-bounds.js";

/**
 * Minimal fake matching only what `createPointerBoundsResolver` touches
 * (`isConnected`/`querySelector`). There is no real DOM in this test runner (Node, no jsdom), so
 * this stands in for both the shell's outer surface and a mounted game canvas.
 */
class FakeElement implements PointerBoundsElement {
  public isConnected = true;
  public queryCount = 0;

  public constructor(public child: FakeElement | null = null) {}

  public querySelector<T extends PointerBoundsElement>(): T | null {
    this.queryCount += 1;
    return this.child as unknown as T | null;
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "CR2-012 the bounds element is queried once and reused across many calls on one screen",
    run: () => {
      const canvas = new FakeElement();
      const surface = new FakeElement(canvas);
      const resolve = createPointerBoundsResolver(surface, () => "game");

      const first = resolve();
      for (let i = 0; i < 50; i += 1) {
        resolve();
      }

      assert(first === canvas, "the resolver must find and return the canvas, not the surface");
      assert(
        surface.queryCount === 1,
        `the surface must be queried exactly once across 51 calls on an unchanged screen, got ${surface.queryCount}`,
      );
    },
  },
  {
    name: "CR2-012 a screen change invalidates the cache and triggers exactly one re-query",
    run: () => {
      // ShellView unmounts/remounts <GameView> across a screen transition, so the canvas
      // querySelector finds is a genuinely different element afterward -- not the same node
      // toggled. Modeled here by swapping `surface.child`, with the same surface and resolver
      // instance used throughout, exactly as the real, single, app-lifetime-long resolver would
      // see it in production.
      const preGameCanvas = new FakeElement();
      const surface = new FakeElement(preGameCanvas);
      let screen = "pre-game";
      const resolve = createPointerBoundsResolver(surface, () => screen);

      const resolvedBefore = resolve();
      resolve();
      assert(resolvedBefore === preGameCanvas, "before the transition, the resolver must find the pre-game screen's canvas");
      assert(surface.queryCount === 1, "the pre-game screen must not itself trigger repeat queries");

      const gameCanvas = new FakeElement();
      surface.child = gameCanvas;
      screen = "game";

      const resolvedAfter = resolve();
      resolve();
      resolve();

      assert(resolvedAfter === gameCanvas, "after a screen change, the resolver must find the new screen's own canvas, not the stale one");
      const totalQueries: number = surface.queryCount;
      assert(
        totalQueries === 2,
        `a screen change must trigger exactly one re-query (the second call overall), then cache again, got ${totalQueries}`,
      );
    },
  },
  {
    name: "CR2-012 a detached cached element is re-queried even without a screen change",
    run: () => {
      const canvas = new FakeElement();
      const surface = new FakeElement(canvas);
      const resolve = createPointerBoundsResolver(surface, () => "game");

      resolve();
      assert(surface.queryCount === 1, "fixture premise: the canvas must be cached after the first call");

      // Simulates a transition the screen-identity check missed -- isConnected is the defense in
      // depth for exactly this case.
      canvas.isConnected = false;
      const reResolved = resolve();
      assert(reResolved === canvas, "a fresh query on the same screen must still find the same canvas element");
      const totalQueries: number = surface.queryCount;
      assert(
        totalQueries === 2,
        `a detached cached element must trigger a re-query even on an unchanged screen, got ${totalQueries}`,
      );
    },
  },
  {
    name: "CR2-012 falls back to the surface itself when no canvas is mounted",
    run: () => {
      const surface = new FakeElement(null);
      const resolve = createPointerBoundsResolver(surface, () => "launcher");

      const resolved = resolve();
      resolve();
      assert(resolved === surface, "outside gameplay, the resolver must fall back to the surface itself");
      assert(surface.queryCount === 1, "the missing-canvas result must still be cached, not re-queried every call");
    },
  },
];
