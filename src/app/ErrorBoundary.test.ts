import { ErrorBoundary } from "./ErrorBoundary.js";
import { shouldInjectFailure } from "./failure-injection.js";
import { assert, type TestCase } from "../test/harness.js";

export const tests: readonly TestCase[] = [
  {
    name: "error boundary captures render failures for fallback UI",
    run: () => {
      const error = new Error("injected");
      const state = ErrorBoundary.getDerivedStateFromError(error);
      assert(state.error === error, "boundary must retain the render error");
    },
  },
  {
    name: "failure injection is development-only and explicit",
    run: () => {
      assert(
        shouldInjectFailure(
          "?injectStartupFailure=1",
          "injectStartupFailure",
          true,
        ),
        "explicit development startup injection must be enabled",
      );
      assert(
        !shouldInjectFailure(
          "?injectStartupFailure=1",
          "injectStartupFailure",
          false,
        ),
        "release mode must ignore injected failures",
      );
    },
  },
];
