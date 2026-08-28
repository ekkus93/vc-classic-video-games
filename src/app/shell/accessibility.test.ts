import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  GameRegistry,
  MemoryJsonDocumentStore,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { ShellView } from "./ShellView.js";
import { ShellController, type ShellState } from "./controller.js";
import { UnavailableGameHost } from "./game-host.js";

function controller(): ShellController {
  return new ShellController({
    registry: new GameRegistry(),
    documents: new MemoryJsonDocumentStore(),
    gameHost: new UnavailableGameHost(),
  });
}

export const tests: readonly TestCase[] = [
  {
    name: "shell status warning and error messages expose non-color-only semantics",
    run: () => {
      const shell = controller();
      const state: ShellState = Object.freeze({
        ...shell.snapshot,
        status: "Settings saved",
        warning: "Fullscreen unavailable",
        error: "Score storage unavailable",
      });
      const markup = renderToStaticMarkup(
        createElement(ShellView, { controller: shell, state }),
      );

      assert(markup.includes('aria-live="polite"'), "status region must announce updates");
      assert(markup.includes('role="status"'), "routine status must use status semantics");
      assert(markup.includes('role="alert"'), "warning/error messages must use alert semantics");
      assert(markup.includes("Warning: Fullscreen unavailable"), "warning state must include a text label");
      assert(markup.includes("Error: Score storage unavailable"), "error state must include a text label");
      assert(markup.includes("Dismiss message"), "messages must have an explicit keyboard-operable dismissal");
    },
  },
  {
    name: "launcher exposes a managed focus target without pointer input",
    run: () => {
      const shell = controller();
      const markup = renderToStaticMarkup(
        createElement(ShellView, { controller: shell, state: shell.snapshot }),
      );

      assert(
        markup.includes('data-shell-focus="true"'),
        "current shell selection must be exposed to focus synchronization",
      );
      assert(
        markup.includes("Settings &amp; controls"),
        "empty-library launcher must retain a keyboard-operable action",
      );
    },
  },
];
