import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./App.js";
import { assert, type TestCase } from "../test/harness.js";

export const tests: readonly TestCase[] = [
  {
    name: "launcher shell renders controller-first registered-game state",
    run: () => {
      const markup = renderToStaticMarkup(createElement(App));
      assert(
        markup.includes("VC Classic Video Games"),
        "launcher identity must render",
      );
      assert(markup.includes("Retro Arcade"), "launcher title must render");
      assert(
        markup.includes("Settings &amp; controls"),
        "settings must remain reachable with games registered",
      );
      assert(
        markup.includes("Space Rocks"),
        "canonical registry must surface the first playable game",
      );
      assert(
        markup.includes("Missile Defense"),
        "canonical registry must surface the P8 playable game",
      );
      assert(
        markup.includes("Available games"),
        "registered games must render through the launcher collection",
      );
      assert(
        !markup.includes("Game cabinet ready"),
        "empty-library placeholder must disappear once a game is registered",
      );
    },
  },
];
