import type { InputService } from "../game/services.js";
import { calculateViewport } from "../render/viewport.js";
import { assert, assertDeepEqual, type TestCase } from "../../test/harness.js";
import { LOGICAL_ACTIONS } from "./actions.js";
import {
  GamepadAssignmentManager,
  StandardGamepadInputProvider,
  normalizeGamepadAxis,
  type GamepadLike,
  type GamepadSource,
} from "./gamepad.js";
import { InputManager } from "./input-manager.js";
import { KeyboardInputProvider } from "./keyboard.js";
import {
  cloneKeyboardMappings,
  createDefaultKeyboardMappings,
  findKeyboardMappingConflicts,
  freezeKeyboardMappings,
} from "./mappings.js";
import { PointerInputProvider } from "./pointer.js";
import {
  InputMappingConflictError,
  InputSettingsController,
  MemoryInputSettingsStore,
  createDefaultInputSettings,
} from "./settings.js";
import { ShellInputRouter, moveMenuSelection } from "./shell-navigation.js";

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

function pad(index = 0): MutableGamepad {
  return {
    index,
    id: `pad-${index}`,
    connected: true,
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

function button(gamepad: MutableGamepad, index: number, pressed: boolean): void {
  const state = gamepad.buttons[index];
  if (state === undefined) {
    throw new Error(`missing button ${index}`);
  }
  state.pressed = pressed;
  state.value = pressed ? 1 : 0;
}

function harness() {
  const keyboard = new KeyboardInputProvider();
  const source = new MutableGamepadSource();
  const gamepad = new StandardGamepadInputProvider(source);
  const pointer = new PointerInputProvider(() =>
    calculateViewport({ width: 320, height: 240 }, { width: 1366, height: 768 }),
  );
  let settings = createDefaultInputSettings();
  const input = new InputManager(keyboard, gamepad, pointer, () => settings);
  return {
    keyboard,
    source,
    gamepad,
    pointer,
    input,
    setSettings: (next: typeof settings) => {
      settings = next;
    },
  };
}

function controllerFrame(
  gamepad: MutableGamepad,
  index: number,
  pressed: boolean,
  testHarness: ReturnType<typeof harness>,
): void {
  button(gamepad, index, pressed);
  testHarness.input.poll();
}

function aimAndFire(input: InputService) {
  const pointer = input.pointer.snapshot();
  return {
    target: pointer.position,
    fire: pointer.primaryPressed || input.wasPressed(1, "action-1"),
  };
}

export const tests: readonly TestCase[] = [
  {
    name: "logical action schema is the release-one virtual controller",
    run: () => {
      assertDeepEqual([...LOGICAL_ACTIONS], [
        "up",
        "down",
        "left",
        "right",
        "action-1",
        "action-2",
        "start",
        "pause",
        "back",
      ], "logical actions");
    },
  },
  {
    name: "default keyboard mappings cover both players without conflicts",
    run: () => {
      const mappings = createDefaultKeyboardMappings();
      assertDeepEqual(mappings[1].up, ["ArrowUp"], "P1 arrows");
      assertDeepEqual(mappings[1]["action-1"], ["KeyZ", "Space"], "P1 action");
      assertDeepEqual(mappings[2].up, ["KeyW"], "P2 WASD");
      assertDeepEqual(mappings[2]["action-1"], ["KeyF"], "P2 action");
      assert(findKeyboardMappingConflicts(mappings).length === 0, "defaults conflict");
    },
  },
  {
    name: "keyboard repeat does not duplicate pressed edges",
    run: () => {
      const keyboard = new KeyboardInputProvider();
      keyboard.keyDown("ArrowLeft");
      assert(keyboard.isHeld("ArrowLeft") && keyboard.wasPressed("ArrowLeft"), "press");
      keyboard.clearEdges();
      keyboard.keyDown("ArrowLeft", true);
      keyboard.keyDown("ArrowLeft", true);
      assert(keyboard.isHeld("ArrowLeft") && !keyboard.wasPressed("ArrowLeft"), "repeat");
      keyboard.keyUp("ArrowLeft");
      assert(!keyboard.isHeld("ArrowLeft") && keyboard.wasReleased("ArrowLeft"), "release");
    },
  },
  {
    name: "analog dead zone suppresses noise and rescales travel",
    run: () => {
      assert(normalizeGamepadAxis(0.05) === 0, "noise");
      assert(normalizeGamepadAxis(-0.2) === 0, "dead-zone edge");
      assert(normalizeGamepadAxis(1) === 1 && normalizeGamepadAxis(-1) === -1, "full travel");
      assert(Math.abs(normalizeGamepadAxis(0.6) - 0.5) < 1e-12, "rescale");
    },
  },
  {
    name: "standard gamepad maps buttons d-pad and stick",
    run: () => {
      const source = new MutableGamepadSource();
      const gamepad = pad();
      source.gamepads = [gamepad];
      const provider = new StandardGamepadInputProvider(source);
      provider.poll();
      button(gamepad, 0, true);
      button(gamepad, 15, true);
      gamepad.axes[1] = -1;
      provider.poll();
      assert(provider.isHeld(1, "action-1"), "A");
      assert(provider.isHeld(1, "right"), "d-pad");
      assert(provider.isHeld(1, "up"), "stick");
      assert(provider.wasPressed(1, "action-1"), "press edge");
      button(gamepad, 0, false);
      provider.poll();
      assert(provider.wasReleased(1, "action-1"), "release edge");
    },
  },
  {
    name: "gamepad assignments are stable and isolate two players",
    run: () => {
      const source = new MutableGamepadSource();
      const first = pad(3);
      const second = pad(7);
      source.gamepads = [first, second];
      const assignments = new GamepadAssignmentManager();
      const provider = new StandardGamepadInputProvider(source, assignments);
      provider.poll();
      assert(assignments.gamepadForPlayer(1) === 3, "P1 assignment");
      assert(assignments.gamepadForPlayer(2) === 7, "P2 assignment");
      button(first, 14, true);
      button(second, 15, true);
      provider.poll();
      assert(provider.isHeld(1, "left") && provider.isHeld(2, "right"), "isolation");
      provider.poll();
      assert(assignments.gamepadForPlayer(1) === 3, "stable assignment");
      first.connected = false;
      provider.poll();
      assert(assignments.gamepadForPlayer(1) === null, "disconnect");
      assert(assignments.gamepadForPlayer(2) === 7, "other assignment stable");
    },
  },
  {
    name: "pointer maps letterboxed coordinates into logical game space",
    run: () => {
      const viewport = calculateViewport(
        { width: 320, height: 240 },
        { width: 1366, height: 768 },
      );
      const pointer = new PointerInputProvider(() => viewport);
      pointer.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
      pointer.buttonDown(0);
      const frame = pointer.consumeFrame();
      assert(frame.inside && frame.primaryHeld && frame.primaryPressed, "pointer state");
      assert(frame.position?.x === 160 && frame.position.y === 120, "logical center");
      pointer.move(viewport.x - 1, viewport.y);
      assert(!pointer.consumeFrame().inside, "letterbox exclusion");
    },
  },
  {
    name: "input manager exposes logical held pressed and released states",
    run: () => {
      const h = harness();
      h.input.poll();
      h.keyboard.keyDown("ArrowUp");
      h.input.poll();
      assert(h.input.isHeld(1, "up") && h.input.wasPressed(1, "up"), "logical press");
      h.input.poll();
      assert(h.input.isHeld(1, "up") && !h.input.wasPressed(1, "up"), "one-frame edge");
      h.keyboard.keyUp("ArrowUp");
      h.input.poll();
      assert(!h.input.isHeld(1, "up") && h.input.wasReleased(1, "up"), "logical release");
    },
  },
  {
    name: "mixed devices do not create false aggregate release",
    run: () => {
      const h = harness();
      const gamepad = pad();
      h.source.gamepads = [gamepad];
      button(gamepad, 12, true);
      h.keyboard.keyDown("ArrowUp");
      h.input.poll();
      h.keyboard.keyUp("ArrowUp");
      h.input.poll();
      assert(h.input.isHeld(1, "up"), "gamepad remains held");
      assert(!h.input.wasReleased(1, "up"), "no false release");
    },
  },
  {
    name: "cursor-target gameplay can aim and fire through InputService only",
    run: () => {
      const h = harness();
      const viewport = calculateViewport(
        { width: 320, height: 240 },
        { width: 1366, height: 768 },
      );
      h.pointer.move(viewport.x + 80 * viewport.scale, viewport.y + 40 * viewport.scale);
      h.pointer.buttonDown(0);
      h.input.poll();
      const command = aimAndFire(h.input);
      assert(command.fire, "fire");
      assert(command.target?.x === 80 && command.target.y === 40, "logical aim");
    },
  },
  {
    name: "remap survives controller reconstruction through settings store",
    run: async () => {
      const store = new MemoryInputSettingsStore();
      const first = new InputSettingsController(store);
      await first.load();
      await first.setKeyboardBinding(1, "action-1", ["KeyQ"]);
      const restarted = new InputSettingsController(store);
      const loaded = await restarted.load();
      assertDeepEqual(loaded.keyboard[1]["action-1"], ["KeyQ"], "persisted remap");
    },
  },
  {
    name: "mapping conflicts are rejected and defaults can be restored",
    run: async () => {
      const controller = new InputSettingsController(new MemoryInputSettingsStore());
      await controller.load();
      let conflict: unknown = null;
      try {
        await controller.setKeyboardBinding(1, "action-1", ["ArrowUp"]);
      } catch (error) {
        conflict = error;
      }
      assert(conflict instanceof InputMappingConflictError, "conflict rejection");
      await controller.setKeyboardBinding(1, "action-1", ["KeyQ"]);
      await controller.resetDefaults();
      assertDeepEqual(controller.current.keyboard[1]["action-1"], ["KeyZ", "Space"], "defaults");
    },
  },
  {
    name: "mapping settings expose remapping UI subscriptions",
    run: async () => {
      const controller = new InputSettingsController(new MemoryInputSettingsStore());
      const seen: string[][] = [];
      const unsubscribe = controller.subscribe((settings) => {
        seen.push([...settings.keyboard[1]["action-2"]]);
      });
      await controller.load();
      await controller.setKeyboardBinding(1, "action-2", ["KeyV"]);
      unsubscribe();
      await controller.resetDefaults();
      assert(
        JSON.stringify(seen) === JSON.stringify([["KeyX", "ShiftLeft"], ["KeyV"]]),
        "subscription sequence",
      );
    },
  },
  {
    name: "validated remap applies immediately and WASD still navigates shell",
    run: () => {
      const h = harness();
      const mutable = cloneKeyboardMappings(createDefaultKeyboardMappings());
      mutable[1]["action-1"] = ["KeyQ"];
      h.setSettings({ version: 1, keyboard: freezeKeyboardMappings(mutable) });
      h.keyboard.keyDown("KeyQ");
      h.input.poll();
      assert(h.input.wasPressed(1, "action-1"), "remap applies");
      h.input.reset();
      h.keyboard.keyDown("KeyW");
      h.input.poll();
      assertDeepEqual(new ShellInputRouter().commands(h.input, "launcher"), ["up"], "WASD shell");
      assert(!h.input.isHeld(1, "up") && h.input.isHeld(2, "up"), "gameplay isolation");
    },
  },
  {
    name: "controller-only shell route covers launch pause restart and exit",
    run: () => {
      const h = harness();
      const gamepad = pad();
      h.source.gamepads = [gamepad];
      h.input.poll();
      const router = new ShellInputRouter();
      controllerFrame(gamepad, 0, true, h);
      assertDeepEqual(router.commands(h.input, "launcher"), ["activate"], "launch");
      controllerFrame(gamepad, 0, false, h);
      controllerFrame(gamepad, 9, true, h);
      assertDeepEqual(router.commands(h.input, "running"), ["pause"], "pause");
      controllerFrame(gamepad, 9, false, h);
      controllerFrame(gamepad, 9, true, h);
      assertDeepEqual(router.commands(h.input, "paused"), ["back"], "resume");
      controllerFrame(gamepad, 9, false, h);

      const items = ["resume", "restart", "return-to-launcher"] as const;
      let selection = 0;
      for (const expected of ["restart", "return-to-launcher"] as const) {
        controllerFrame(gamepad, 13, true, h);
        const navigation = router.commands(h.input, "paused");
        selection = moveMenuSelection(selection, items.length, navigation[0] ?? "activate");
        controllerFrame(gamepad, 13, false, h);
        controllerFrame(gamepad, 0, true, h);
        assert(router.commands(h.input, "paused").includes("activate"), "activate menu");
        assert(items[selection] === expected, expected);
        controllerFrame(gamepad, 0, false, h);
      }
    },
  },
];
