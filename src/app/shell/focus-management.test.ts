import { assert, type TestCase } from "../../test/harness.js";
import { moveFocusToShellSelection } from "./focus-management.js";

interface FakeElementOptions {
  readonly focusable?: boolean;
  readonly child?: HTMLElement | null;
  readonly onFocus?: () => void;
}

function fakeElement(options: FakeElementOptions = {}): HTMLElement {
  return {
    matches: () => options.focusable === true,
    querySelector: () => options.child ?? null,
    focus: () => options.onFocus?.(),
  } as unknown as HTMLElement;
}

export const tests: readonly TestCase[] = [
  {
    name: "managed shell focus follows the selected interactive control",
    run: () => {
      let focused = "";
      const selected = fakeElement({
        focusable: true,
        onFocus: () => {
          focused = "selected";
        },
      });
      const surface = {
        querySelector: (selector: string) =>
          selector.includes("data-shell-focus") ? selected : null,
        focus: () => {
          focused = "surface";
        },
      } as unknown as HTMLElement;

      const target = moveFocusToShellSelection(surface);

      assert(target === selected, "selected interactive element must receive focus");
      assert(focused === "selected", "selected control focus callback must run");
    },
  },
  {
    name: "managed shell focus resolves a selected label to its nested control",
    run: () => {
      let focused = "";
      const input = fakeElement({
        focusable: true,
        onFocus: () => {
          focused = "input";
        },
      });
      const label = fakeElement({ focusable: false, child: input });
      const surface = {
        querySelector: (selector: string) =>
          selector.includes("data-shell-focus") ? label : null,
        focus: () => {
          focused = "surface";
        },
      } as unknown as HTMLElement;

      const target = moveFocusToShellSelection(surface);

      assert(target === input, "selected label must resolve to its nested input");
      assert(focused === "input", "nested input must receive DOM focus");
    },
  },
  {
    name: "managed shell focus falls back to the shell when no control exists",
    run: () => {
      let focused = "";
      const surface = {
        querySelector: () => null,
        focus: () => {
          focused = "surface";
        },
      } as unknown as HTMLElement;

      const target = moveFocusToShellSelection(surface);

      assert(target === surface, "running game without a menu must focus the shell surface");
      assert(focused === "surface", "shell surface focus callback must run");
    },
  },
];
