import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { shouldInjectFailure } from "./failure-injection.js";
import "./styles.css";
import "./shell/pause-pointer-layer.css";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderStartupFailure(error: unknown): void {
  const mount = document.querySelector<HTMLElement>("#app");
  const message = `Launcher startup failure: ${describeError(error)}`;

  if (mount === null) {
    document.body.textContent = message;
    return;
  }

  mount.replaceChildren();

  const panel = document.createElement("main");
  panel.className = "fatal-startup";
  panel.setAttribute("role", "alert");

  const heading = document.createElement("h1");
  heading.textContent = "Launcher could not start";

  const detail = document.createElement("p");
  detail.textContent = describeError(error);

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload launcher";
  reload.addEventListener("click", () => window.location.reload());

  panel.append(heading, detail, reload);
  mount.append(panel);
}

try {
  if (
    shouldInjectFailure(
      window.location.search,
      "injectStartupFailure",
      import.meta.env.DEV,
    )
  ) {
    throw new Error("Injected startup failure");
  }

  const mount = document.querySelector<HTMLElement>("#app");
  if (mount === null) {
    throw new Error("Application mount element #app is missing");
  }

  createRoot(mount).render(
    createElement(
      StrictMode,
      null,
      createElement(ErrorBoundary, null, createElement(App)),
    ),
  );
} catch (error) {
  renderStartupFailure(error);
}
