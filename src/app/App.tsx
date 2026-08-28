import { useEffect, useMemo, useRef, useState } from "react";

import { shouldInjectFailure } from "./failure-injection.js";
import { ShellView } from "./shell/ShellView.js";
import { createDefaultShellController } from "./shell/default-controller.js";
import { moveFocusToShellSelection } from "./shell/focus-management.js";
import { useShellInput } from "./shell/use-shell-input.js";
import type { ShellController, ShellState } from "./shell/controller.js";
import {
  diagnosticPing,
  getPlatformInfo,
  type PlatformInfo,
} from "../native/commands.js";

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
  const shell = useMemo(
    () => controller ?? createDefaultShellController(),
    [controller],
  );
  const [shellState, setShellState] = useState<ShellState>(shell.snapshot);
  const [nativeStatus, setNativeStatus] = useState<NativeStatus>({
    state: "loading",
  });
  const shellSurface = useRef<HTMLElement | null>(null);

  useShellInput(shell, shellSurface);

  useEffect(() => shell.subscribe(setShellState), [shell]);

  useEffect(() => {
    void shell.initialize();
  }, [shell]);

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
