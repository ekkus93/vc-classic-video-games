/**
 * Structural shape `createPointerBoundsResolver` needs from both the surface it queries and the
 * element it may find inside it -- a real `HTMLElement` satisfies this on its own; tests supply a
 * minimal fake instead of a real DOM.
 */
export interface PointerBoundsElement {
  readonly isConnected: boolean;
  querySelector<T extends PointerBoundsElement>(selectors: string): T | null;
}

/**
 * CR2-012: builds the cached "which element is the pointer's physical-coordinate box" resolver
 * `useShellInput` needs for `BrowserPointerAdapter`'s `pointerBoundsSurface` and its own
 * `viewport()` callback -- pulled out of the hook itself so the caching behavior is directly
 * testable without a real DOM (this project has no jsdom), the same way `devicePhysicalSize` was
 * pulled out of `App.tsx`'s present loop in CR2-003.
 *
 * Querying `surface` for `canvas.game-viewport` (see CR-004) used to run on every call -- once per
 * pointer event and once more inside `viewport()`, which every pointer event also triggers -- a
 * per-frame DOM query in the input hot path, for an element that can only change identity when the
 * game screen itself mounts or unmounts. `screen()` reads that identity cheaply (no DOM access);
 * when it changes, the cached element is dropped and re-queried on the next call, since
 * `ShellView`'s conditional rendering unmounts and remounts the canvas across that transition
 * rather than merely hiding it. `isConnected` is a cheap defense in depth against a stale,
 * detached reference if a transition were ever missed.
 *
 * Falls back to `surface` itself when no canvas is mounted (outside gameplay, where pointer
 * position isn't meaningful anyway), matching the pre-CR2-012 behavior.
 */
export function createPointerBoundsResolver<TElement extends PointerBoundsElement>(
  surface: TElement,
  screen: () => unknown,
): () => TElement {
  let cachedElement: TElement | null = null;
  let cachedScreen: unknown;
  let hasCachedScreen = false;

  return () => {
    const currentScreen = screen();
    if (!hasCachedScreen || currentScreen !== cachedScreen) {
      cachedElement = null;
      cachedScreen = currentScreen;
      hasCachedScreen = true;
    }
    if (cachedElement !== null && cachedElement.isConnected) {
      return cachedElement;
    }
    const resolved = surface.querySelector<TElement>("canvas.game-viewport") ?? surface;
    cachedElement = resolved;
    return resolved;
  };
}
