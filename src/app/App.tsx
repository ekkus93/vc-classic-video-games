import { useEffect, useMemo, useRef, useState } from "react";

import { LogicalFramebuffer, presentFramebuffer } from "../engine/index.js";
import {
  diagnosticPing,
  getPlatformInfo,
  type PlatformInfo,
} from "../native/commands.js";
import { shouldInjectFailure } from "./failure-injection.js";
import { ShellView } from "./shell/ShellView.js";
import { resizeCanvasToDevicePixels } from "./shell/canvas-resize.js";
import { createDefaultShellRuntime } from "./shell/default-controller.js";
import { moveFocusToShellSelection } from "./shell/focus-management.js";
import { useShellInput } from "./shell/use-shell-input.js";
import type { ShellController, ShellState } from "./shell/controller.js";

type NativeStatus =
  | { readonly state: "loading" }
  | {
      readonly state: "connected";
      readonly platform: PlatformInfo;
      readonly echo: string;
    }
  | { readonly state: "preview" };

export interface AppProps {
  readonly controller?: ShellController;
}

function renderFailureRequested(): boolean {
  return (
    typeof window !== "undefined" &&
    shouldInjectFailure(
      window.location.search,
      "injectRenderFailure",
      import.meta.env.DEV,
    )
  );
}

export function App({ controller }: AppProps = {}) {
  const runtime = useMemo(
    () => (controller === undefined ? createDefaultShellRuntime() : null),
    [controller],
  );
  const shell = controller ?? runtime?.controller;
  if (shell === undefined) {
    throw new Error("Shell runtime could not be created");
  }

  const [shellState, setShellState] = useState<ShellState>(shell.snapshot);
  const [nativeStatus, setNativeStatus] = useState<NativeStatus>({
    state: "loading",
  });
  const shellSurface = useRef<HTMLElement | null>(null);

  useShellInput(
    shell,
    shellSurface,
    runtime?.gameInput,
    runtime?.unlockAudio,
  );

  useEffect(() => shell.subscribe(setShellState), [shell]);

  useEffect(() => {
    void shell.initialize();
  }, [shell]);

  useEffect(() => {
    const gameHost = runtime?.gameHost;
    if (gameHost === undefined) {
      return undefined;
    }
    if (shellState.screen !== "game") {
      gameHost.setRenderer(null);
      return undefined;
    }

    const game = shell.selectedGame;
    const canvas = shellSurface.current?.querySelector<HTMLCanvasElement>(
      "canvas.game-viewport",
    );
    const displayContext = canvas?.getContext("2d") ?? null;
    if (game === null || canvas == null || displayContext === null) {
      gameHost.setRenderer(null);
      return undefined;
    }

    // CR-005: the game draws into an offscreen logical-resolution framebuffer, and a small
    // shell-owned present loop blits it onto the visible canvas through the tested
    // integer-nearest-neighbor viewport scaling (calculateViewport/presentFramebuffer) --
    // matching what P3-005's own tests validate, instead of relying on CSS to stretch a
    // logical-resolution canvas (which doesn't guarantee true integer-only scaling and left that
    // tested code path unused). This present loop is a separate, independently owned RAF chain
    // from the game's own fixed-step/render driver, the same way use-shell-input.ts already owns
    // its own RAF chain for input polling -- both are shell-level concerns, not per-game ones,
    // and each is started/stopped in step with the effect that owns it.
    const framebuffer = new LogicalFramebuffer(
      document.createElement("canvas"),
      game.logicalWidth,
      game.logicalHeight,
    );
    gameHost.setRenderer(framebuffer.renderer);

    let frame = 0;
    const present = (): void => {
      // CR2-003: the backing store is sized in device pixels, not CSS pixels, so the integer
      // scale calculateViewport picks (via presentFramebuffer) is an integer on the physical
      // panel -- what P3-005 actually wants -- rather than merely in the CSS layout unit the
      // browser is about to non-integer-rescale again on any non-1 devicePixelRatio display
      // (1.25x and 1.5x are common Chromebook settings). Recomputed every frame, not just on
      // resize, since window.devicePixelRatio itself changes under browser zoom without firing a
      // resize event; the CSS box (canvas.clientWidth/clientHeight, driven by layout) is
      // untouched, so the browser still composites the backing store onto exactly that box.
      // CR3-002: the resize decision itself lives in resizeCanvasToDevicePixels, testable without
      // a DOM -- this loop keeps no arithmetic of its own.
      resizeCanvasToDevicePixels(canvas, window.devicePixelRatio);
      presentFramebuffer(displayContext, framebuffer, canvas.width, canvas.height);
      frame = window.requestAnimationFrame(present);
    };
    frame = window.requestAnimationFrame(present);

    return () => {
      window.cancelAnimationFrame(frame);
      gameHost.setRenderer(null);
    };
  }, [runtime, shell, shellState.screen, shellState.selection?.gameId]);

  useEffect(
    () => () => {
      runtime?.gameHost.exit();
    },
    [runtime],
  );

  useEffect(() => {
    const surface = shellSurface.current;
    if (surface !== null) {
      moveFocusToShellSelection(surface);
    }
  }, [
    shellState.screen,
    shellState.launcherFocusIndex,
    shellState.preGameFocusIndex,
    shellState.pauseFocusIndex,
    shellState.settingsFocusIndex,
    shellState.gamePaused,
  ]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() =>
        Promise.all([
          getPlatformInfo(),
          diagnosticPing({ message: "launcher-ready" }),
        ]),
      )
      .then(([platform, ping]) => {
        if (!cancelled) {
          setNativeStatus({
            state: "connected",
            platform,
            echo: ping.echo,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativeStatus({ state: "preview" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (renderFailureRequested()) {
    throw new Error("Injected render failure");
  }

  return (
    <main
      className="app-shell"
      ref={shellSurface}
      tabIndex={-1}
      aria-label="VC Classic Video Games shell"
    >
      <ShellView controller={shell} state={shellState} />

      <footer className="shell-footer" aria-label="Application diagnostics">
        <span>
          {nativeStatus.state === "loading"
            ? "Native bridge: checking…"
            : nativeStatus.state === "connected"
              ? `Native bridge: connected (${nativeStatus.echo})`
              : "Native bridge: browser preview"}
        </span>
        <span>
          {nativeStatus.state === "connected"
            ? `${nativeStatus.platform.os}/${nativeStatus.platform.arch} · v${nativeStatus.platform.appVersion}`
            : "Tauri 2 · offline-first"}
        </span>
      </footer>
    </main>
  );
}
