import { assert, type TestCase } from "../../test/harness.js";
import { activateShellUiButton } from "./shell-ui-pointer-routing.js";

function fakeButton(disabled = false): {
  readonly button: { readonly disabled: boolean; focus(): void; click(): void };
  readonly focused: () => number;
  readonly clicked: () => number;
} {
  let focusCount = 0;
  let clickCount = 0;
  return {
    button: {
      disabled,
      focus: () => {
        focusCount += 1;
      },
      click: () => {
        clickCount += 1;
      },
    },
    focused: () => focusCount,
    clicked: () => clickCount,
  };
}

export const tests: readonly TestCase[] = [
  {
    name: "shell UI pointer activation clicks an enabled button once",
    run: () => {
      const probe = fakeButton();
      assert(activateShellUiButton(probe.button, 0), "primary pointer should activate");
      assert(probe.focused() === 1, "activated button should receive focus");
      assert(probe.clicked() === 1, "activated button should receive one programmatic click");
    },
  },
  {
    name: "shell UI pointer activation ignores secondary and disabled buttons",
    run: () => {
      const secondary = fakeButton();
      const disabled = fakeButton(true);
      assert(!activateShellUiButton(secondary.button, 2), "secondary pointer must not activate");
      assert(!activateShellUiButton(disabled.button, 0), "disabled button must not activate");
      assert(secondary.clicked() === 0, "secondary pointer must not click");
      assert(disabled.clicked() === 0, "disabled button must not click");
    },
  },
];
