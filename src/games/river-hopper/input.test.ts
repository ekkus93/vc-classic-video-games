import type { GameServices } from "../../engine/game/services.js";
import {
  StandardGamepadInputProvider,
  type GamepadLike,
  type GamepadSource,
} from "../../engine/input/gamepad.js";
import { InputManager } from "../../engine/input/input-manager.js";
import { KeyboardInputProvider } from "../../engine/input/keyboard.js";
import { PointerInputProvider } from "../../engine/input/pointer.js";
import { createDefaultInputSettings } from "../../engine/input/settings.js";
import { calculateViewport } from "../../engine/render/viewport.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { RIVER_HOPPER_AUDIO_IDS } from "./effects.js";
import { RiverHopperGameInstance } from "./module.js";

interface MutableGamepad extends GamepadLike {
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

class MutableGamepadSource implements GamepadSource {
  public gamepads: (MutableGamepad | null)[] = [];

  public getGamepads(): readonly (GamepadLike | null)[] {
    return this.gamepads;
  }
}

function createPad(): MutableGamepad {
  return {
    index: 0,
    id: "river-hopper-pad",
    connected: true,
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

function setButton(gamepad: MutableGamepad, index: number, pressed: boolean): void {
  const button = gamepad.buttons[index];
  if (button === undefined) {
    throw new Error(`missing gamepad button ${index}`);
  }
  button.pressed = pressed;
  button.value = pressed ? 1 : 0;
}

function createInputHarness() {
  const keyboard = new KeyboardInputProvider();
  const gamepadSource = new MutableGamepadSource();
  const gamepad = new StandardGamepadInputProvider(gamepadSource);
  const pointer = new PointerInputProvider(() =>
    calculateViewport({ width: 320, height: 240 }, { width: 1280, height: 720 }),
  );
  const input = new InputManager(keyboard, gamepad, pointer, () => createDefaultInputSettings());
  return { keyboard, gamepadSource, input };
}

function createGame(input: InputManager) {
  const fakeServices = createFakeGameServices(19);
  const services: GameServices = { ...fakeServices, input };
  const game = new RiverHopperGameInstance(services);
  game.start({ players: 1, difficulty: "channel", seed: 19 });
  return { fakeServices, game };
}

export const tests: readonly TestCase[] = [
  {
    name: "P9 real input stack maps ArrowUp into a River Hopper hop",
    run: () => {
      const harness = createInputHarness();
      const { fakeServices, game } = createGame(harness.input);
      harness.input.poll();
      harness.keyboard.keyDown("ArrowUp");
      harness.input.poll();
      game.update(1 / 60);
      assert(
        fakeServices.audio.playedEffects.includes(RIVER_HOPPER_AUDIO_IDS.hop),
        "default P1 ArrowUp mapping must reach River Hopper through InputManager",
      );
    },
  },
  {
    name: "P9 real input stack maps standard gamepad d-pad up into a River Hopper hop",
    run: () => {
      const harness = createInputHarness();
      const pad = createPad();
      harness.gamepadSource.gamepads = [pad];
      const { fakeServices, game } = createGame(harness.input);
      harness.input.poll();
      setButton(pad, 12, true);
      harness.input.poll();
      game.update(1 / 60);
      assert(
        fakeServices.audio.playedEffects.includes(RIVER_HOPPER_AUDIO_IDS.hop),
        "standard gamepad d-pad up must reach River Hopper through InputManager",
      );
    },
  },
];
