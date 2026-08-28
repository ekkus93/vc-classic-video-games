import { useEffect, useState } from "react";

import { GameSurface } from "./game-surface/GameSurface.js";
import { shouldInjectFailure } from "./failure-injection.js";
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

export function App() {
  const [nativeStatus, setNativeStatus] = useState<NativeStatus>({
    state: "loading",
  });

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
    <main className="app-shell">
      <section className="launcher" aria-labelledby="launcher-title">
        <header className="launcher__header">
          <p className="launcher__eyebrow">VC CLASSIC VIDEO GAMES</p>
          <h1 id="launcher-title">Retro Arcade</h1>
          <p>
            One controller-first arcade shell. Game modules plug into the
            shared runtime without owning application UI state.
          </p>
        </header>

        <div className="launcher__preview">
          <GameSurface />
          <section className="launcher__status" aria-labelledby="preview-title">
            <h2 id="preview-title">Runtime preview</h2>
            <p>
              The animated Canvas is driven by the engine frame loop, not by
              React renders. React owns launcher composition and lifecycle only.
            </p>

            <dl className="launcher__diagnostics">
              <div>
                <dt>Native bridge</dt>
                <dd>
                  {nativeStatus.state === "loading"
                    ? "Checking…"
                    : nativeStatus.state === "connected"
                      ? `Connected (${nativeStatus.echo})`
                      : "Browser preview"}
                </dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>
                  {nativeStatus.state === "connected"
                    ? `${nativeStatus.platform.os} / ${nativeStatus.platform.arch}`
                    : "Available in Tauri"}
                </dd>
              </div>
              <div>
                <dt>App version</dt>
                <dd>
                  {nativeStatus.state === "connected"
                    ? nativeStatus.platform.appVersion
                    : "0.1.0"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    </main>
  );
}
