import type { Viewport } from "../render/viewport.js";
import { BrowserGamepadSource, StandardGamepadInputProvider } from "./gamepad.js";
import { InputManager } from "./input-manager.js";
import { BrowserKeyboardAdapter, KeyboardInputProvider } from "./keyboard.js";
import { BrowserPointerAdapter, PointerInputProvider } from "./pointer.js";
import { LOGICAL_ACTIONS } from "./actions.js";
import type { InputSettings } from "./settings.js";

export interface BrowserInputControllerOptions {
  readonly window: Window;
  readonly pointerSurface: HTMLElement;
  readonly viewport: () => Viewport;
  readonly settings: () => InputSettings;
}

export class BrowserInputController {
  private readonly keyboard = new KeyboardInputProvider();
  private readonly gamepad: StandardGamepadInputProvider;
  private readonly pointer: PointerInputProvider;
  private readonly keyboardAdapter: BrowserKeyboardAdapter;
  private readonly pointerAdapter: BrowserPointerAdapter;
  public readonly input: InputManager;

  public constructor(options: BrowserInputControllerOptions) {
    this.gamepad = new StandardGamepadInputProvider(
      new BrowserGamepadSource(options.window.navigator),
    );
    this.pointer = new PointerInputProvider(options.viewport);
    this.keyboardAdapter = new BrowserKeyboardAdapter(
      options.window,
      this.keyboard,
      (code) =>
        ([1, 2, 3, 4] as const).some((player) =>
          LOGICAL_ACTIONS.some((action) =>
            options.settings().keyboard[player][action].includes(code),
          ),
        ),
    );
    this.pointerAdapter = new BrowserPointerAdapter(options.pointerSurface, this.pointer);
    this.input = new InputManager(
      this.keyboard,
      this.gamepad,
      this.pointer,
      options.settings,
    );
  }

  public attach(): void {
    this.keyboardAdapter.attach();
    this.pointerAdapter.attach();
  }

  public poll(): void {
    this.input.poll();
  }

  public detach(): void {
    this.keyboardAdapter.detach();
    this.pointerAdapter.detach();
    this.input.reset();
  }
}
