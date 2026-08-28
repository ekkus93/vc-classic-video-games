import { useEffect, useMemo, useRef, useState } from "react";

import { CanvasGameRenderer } from "../engine/index.js";
import {
  diagnosticPing,
  getPlatformInfo,
  type PlatformInfo,
} from "../native/commands.js";
import { shouldInjectFailure } from "./failure-injection.js";
import { ShellView } from "./shell/ShellView.js";
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
    const context = canvas?.getContext("2d") ?? null;
    if (game === null || canvas == null || context === null) {
      gameHost.setRenderer(null);
      return undefined;
    }

    canvas.width = game.logicalWidth;
    canvas.height = game.logicalHeight;
    const renderer = new CanvasGameRenderer(
      context,
      game.logicalWidth,
      game.logicalHeight,
    );
    gameHost.setRenderer(renderer);

    return () => {
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
