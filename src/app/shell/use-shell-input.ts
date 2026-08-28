import { useEffect, type RefObject } from "react";

import {
  BrowserInputController,
  ShellInputRouter,
  calculateViewport,
} from "../../engine/index.js";
import type { ShellController } from "./controller.js";

export function useShellInput(
  controller: ShellController,
  surfaceRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) {
      return undefined;
    }

    const input = new BrowserInputController({
      window,
      pointerSurface: surface,
      viewport: () =>
        calculateViewport(
          { width: 320, height: 240 },
          {
            width: Math.max(1, surface.clientWidth),
            height: Math.max(1, surface.clientHeight),
          },
        ),
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

    input.attach();
    frame = window.requestAnimationFrame(poll);

    return () => {
      window.cancelAnimationFrame(frame);
      input.detach();
    };
  }, [controller, surfaceRef]);
}
