import {
  StandardGamepadInputProvider,
  createDefaultKeyboardMappings,
  type GamepadLike,
  type GamepadSource,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";

export const tests: readonly TestCase[] = [
  {
    name: "P15 keyboard and standard gamepad expose every Star Defender gameplay action",
    run: () => {
      const keyboard = createDefaultKeyboardMappings()[1];
      for (const action of [
        "up",
        "down",
        "left",
        "right",
        "action-1",
        "action-2",
        "pause",
      ] as const) {
        assert(
          keyboard[action].length > 0,
          `default keyboard mapping must expose ${action}`,
        );
      }

      const buttons = Array.from({ length: 16 }, () => ({
        pressed: false,
        value: 0,
      }));
      const actionOne = buttons[0];
      const actionTwo = buttons[1];
      const pause = buttons[9];
      const up = buttons[12];
      const right = buttons[15];
      assert(
        actionOne !== undefined &&
          actionTwo !== undefined &&
          pause !== undefined &&
          up !== undefined &&
          right !== undefined,
        "standard gamepad fixture must expose required buttons",
      );
      actionOne.pressed = true;
      actionTwo.pressed = true;
      pause.pressed = true;
      up.pressed = true;
      right.pressed = true;

      const pad: GamepadLike = {
        index: 0,
        id: "P15 standard pad",
        connected: true,
        mapping: "standard",
        buttons,
        axes: [0, 0],
      };
      const source: GamepadSource = {
        getGamepads: () => [pad],
      };
      const gamepad = new StandardGamepadInputProvider(source);
      gamepad.poll();

      assert(gamepad.isHeld(1, "up"), "D-pad up must reach the shared Up action");
      assert(gamepad.isHeld(1, "right"), "D-pad right must reach the shared Right action");
      assert(
        gamepad.isHeld(1, "action-1") && gamepad.isHeld(1, "action-2"),
        "standard face buttons must expose both Star Defender actions",
      );
      assert(gamepad.isHeld(1, "pause"), "standard Start must expose Pause");
    },
  },
];
