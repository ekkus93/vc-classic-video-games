import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./App.js";
import { assert, type TestCase } from "../test/harness.js";

export const tests: readonly TestCase[] = [
  {
    name: "launcher shell renders independently of a browser canvas",
    run: () => {
      const markup = renderToStaticMarkup(createElement(App));
      assert(
        markup.includes("VC Classic Video Games"),
        "launcher title must render",
      );
      assert(markup.includes("<canvas"), "runtime surface must render");
    },
  },
];
