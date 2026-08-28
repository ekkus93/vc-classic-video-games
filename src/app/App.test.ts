import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./App.js";
import { assert, type TestCase } from "../test/harness.js";

export const tests: readonly TestCase[] = [
  {
    name: "launcher shell renders controller-first empty-library state",
    run: () => {
      const markup = renderToStaticMarkup(createElement(App));
      assert(
        markup.includes("VC Classic Video Games"),
        "launcher identity must render",
      );
      assert(markup.includes("Retro Arcade"), "launcher title must render");
      assert(
        markup.includes("Settings &amp; controls"),
        "settings must be reachable before games are registered",
      );
      assert(
        markup.includes("Game cabinet ready"),
        "empty game registry must remain usable",
      );
    },
  },
];
