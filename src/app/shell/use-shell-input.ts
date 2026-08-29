import { useEffect, type RefObject } from "react";

import {
  BrowserInputController,
  ShellInputRouter,
  calculateViewport,
} from "../../engine/index.js";
import {
  attachAudioUnlockGestures,
  type AudioUnlock,
} from "./audio-unlock-gesture.js";
import type { ShellController } from "./controller.js";
import type { ShellGameInputBridge } from "./input-bridge.js";
import { createPointerBoundsResolver } from "./pointer-bounds.js";
import { pointerViewportPhysicalSize } from "./pointer-viewport.js";

export function useShellInput(
  controller: ShellController,
  surfaceRef: RefObject<HTMLElement | null>,
  gameInput?: ShellGameInputBridge,
  audioUnlock?: AudioUnlock,
): void {
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) {
      return undefined;
    }

    // CR-004: the game canvas is the actual on-screen box a pointer should be measured against,
    // not this outer shell container -- `surface` (<main class="app-shell">) carries its own
    // padding/header/footer chrome around the canvas, so using its size/bounds for pointer math
    // misaligned pointer-aimed gameplay (e.g. Missile Defense's cursor) from where the pointer
    // visually is. Falls back to the shell surface itself outside gameplay, where pointer
    // position isn't meaningful anyway. CR2-012: cached rather than re-queried on every call --
    // see createPointerBoundsResolver's own doc for why and how.
    const resolvePointerBoundsElement = createPointerBoundsResolver(
      surface,
      () => controller.snapshot.screen,
    );

    const input = new BrowserInputController({
      window,
      pointerSurface: surface,
      pointerBoundsSurface: resolvePointerBoundsElement,
      // CR2-003: sized in device pixels -- see App.tsx's present loop, which sizes the visible
      // canvas's backing store the same way -- and paired with BrowserPointerAdapter's own
      // devicePixelRatio option below, so both sides quantize calculateViewport's integer scale
      // identically. See BrowserPointerAdapter's constructor doc for why they must match exactly,
      // not merely each be correct on their own.
      viewport: () => {
        const game = controller.selectedGame;
        const bounds = resolvePointerBoundsElement();
        const dpr = window.devicePixelRatio;
        return calculateViewport(
          {
            width: game?.logicalWidth ?? 320,
            height: game?.logicalHeight ?? 240,
          },
          pointerViewportPhysicalSize(bounds, dpr),
        );
      },
      devicePixelRatio: () => window.devicePixelRatio,
      settings: () => controller.snapshot.settings.input,
    });
    const router = new ShellInputRouter();
    let frame = 0;

    const poll = (): void => {
      input.poll();
      for (const command of router.commands(input.input, controller.inputContext)) {
        void controller.handleCommand(command);
      }
      frame = window.requestAnimationFrame(poll);
    };

    const detachAudioUnlock =
      audioUnlock === undefined
        ? () => undefined
        : attachAudioUnlockGestures(window, surface, audioUnlock);

    input.attach();
    gameInput?.attach(input.input);
    frame = window.requestAnimationFrame(poll);

    return () => {
      window.cancelAnimationFrame(frame);
      detachAudioUnlock();
      gameInput?.detach(input.input);
      input.detach();
    };
  }, [controller, surfaceRef, gameInput, audioUnlock]);
}
