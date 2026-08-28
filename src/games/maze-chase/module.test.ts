import {
  InputManager,
  KeyboardInputProvider,
  PointerInputProvider,
  StandardGamepadInputProvider,
  calculateViewport,
  createDefaultInputSettings,
  type GamepadLike,
  type GamepadSource,
  type GameServices,
} from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import { MAZE_CHASE_AUDIO_IDS } from "./effects.js";
import { MazeChaseGameInstance, MAZE_CHASE_MODULE } from "./module.js";

interface MutablePad extends GamepadLike {
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

class MutablePadSource implements GamepadSource {
  public gamepads: (MutablePad | null)[] = [];
  public getGamepads(): readonly (GamepadLike | null)[] {
    return this.gamepads;
  }
}

function createInputHarness(): {
  readonly keyboard: KeyboardInputProvider;
  readonly source: MutablePadSource;
  readonly input: InputManager;
} {
  const keyboard = new KeyboardInputProvider();
  const source = new MutablePadSource();
  const gamepad = new StandardGamepadInputProvider(source);
  const pointer = new PointerInputProvider(() =>
    calculateViewport({ width: 320, height: 240 }, { width: 1280, height: 720 }),
  );
  const settings = createDefaultInputSettings();
  return {
    keyboard,
    source,
    input: new InputManager(keyboard, gamepad, pointer, () => settings),
  };
}

function createPad(): MutablePad {
  return {
    index: 0,
    id: "maze-pad",
    connected: true,
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

function setButton(pad: MutablePad, index: number, pressed: boolean): void {
  const button = pad.buttons[index];
  if (button === undefined) {
    throw new Error(`missing button ${index}`);
  }
  button.pressed = pressed;
  button.value = pressed ? 1 : 0;
}

function startInstance(services: GameServices): MazeChaseGameInstance {
  const instance = new MazeChaseGameInstance(services);
  instance.start({ players: 1, difficulty: "circuit", seed: 0x10aa });
  return instance;
}

export const tests: readonly TestCase[] = [
  {
    name: "P10-010 module resolves only its own bundled manifest and original audio",
    run: () => {
      assert(MAZE_CHASE_MODULE.resolveAssetUrl?.("assets.json")?.includes("assets.json") === true, "manifest must resolve from the game module");
      assert(MAZE_CHASE_MODULE.resolveAssetUrl?.("audio/pellet.wav")?.includes("pellet.wav") === true, "declared audio must resolve from the game module");
      assert(MAZE_CHASE_MODULE.resolveAssetUrl?.("../other.wav") === null, "unknown or cross-module asset paths must fail closed");
    },
  },
  {
    name: "P10-002 keyboard ArrowRight reaches real Maze Chase movement through shared InputManager",
    run: () => {
      const h = createInputHarness();
      const fake = createFakeGameServices(0x10aa);
      const services: GameServices = { ...fake, input: h.input };
      const instance = startInstance(services);
      h.keyboard.keyDown("ArrowRight");
      h.input.poll();
      instance.update(0.2);
      assert(
        fake.audio.playedEffects.includes(MAZE_CHASE_AUDIO_IDS.pellet),
        "keyboard movement must advance the real game far enough to collect the adjacent pellet",
      );
      instance.destroy();
    },
  },
  {
    name: "P10-002 standard gamepad d-pad reaches the same real Maze Chase logical movement path",
    run: () => {
      const h = createInputHarness();
      const pad = createPad();
      h.source.gamepads = [pad];
      const fake = createFakeGameServices(0x10bb);
      const services: GameServices = { ...fake, input: h.input };
      const instance = startInstance(services);
      setButton(pad, 15, true);
      h.input.poll();
      instance.update(0.2);
      assert(
        fake.audio.playedEffects.includes(MAZE_CHASE_AUDIO_IDS.pellet),
        "standard gamepad right input must drive the same production game instance",
      );
      instance.destroy();
    },
  },
  {
    name: "P10-011 pause freezes update and reset restores a clean seeded run",
    run: () => {
      const services = createFakeGameServices(0x10cc);
      const instance = startInstance(services);
      services.input.setHeld(1, "right", true);
      instance.pause();
      instance.update(0.25);
      assert(services.audio.playedEffects.length === 0, "paused instance must not advance gameplay");
      instance.resume();
      instance.update(0.2);
      assert(services.audio.playedEffects.includes(MAZE_CHASE_AUDIO_IDS.pellet), "resume must reactivate gameplay updates");
      services.input.setHeld(1, "right", false);
      const effectCount = services.audio.playedEffects.length;
      instance.reset();
      services.input.setHeld(1, "right", true);
      instance.update(0.2);
      assert(services.audio.playedEffects.length > effectCount, "reset must rebuild the run from the same start state");
      instance.render(new FakeGameRenderer());
      instance.destroy();
    },
  },
  {
    name: "P10-011 module rejects unsupported player count and difficulty before gameplay",
    run: () => {
      const services = createFakeGameServices();
      const instance = new MazeChaseGameInstance(services);
      let playersRejected = false;
      try {
        instance.start({ players: 2, difficulty: "circuit", seed: 1 });
      } catch (error) {
        playersRejected = error instanceof Error;
      }
      let difficultyRejected = false;
      try {
        instance.start({ players: 1, difficulty: "impossible", seed: 1 });
      } catch (error) {
        difficultyRejected = error instanceof Error;
      }
      assert(playersRejected && difficultyRejected, "invalid launch options must fail closed");
      instance.destroy();
    },
  },
];
