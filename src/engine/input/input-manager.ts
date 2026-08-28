import type { InputService } from "../game/services.js";
import {
  LOGICAL_ACTIONS,
  isPlayerNumber,
  type LogicalAction,
  type PlayerNumber,
} from "./actions.js";
import type { StandardGamepadInputProvider } from "./gamepad.js";
import type { KeyboardInputProvider } from "./keyboard.js";
import { keyboardCodesForAction } from "./mappings.js";
import {
  StaticPointerInputService,
  type PointerInputProvider,
  type PointerInputService,
} from "./pointer.js";
import type { InputSettings } from "./settings.js";

function actionKey(player: PlayerNumber, action: LogicalAction): string {
  return `${player}:${action}`;
}

export type InputSettingsProvider = () => InputSettings;

export class InputManager implements InputService {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private readonly pointerState = new StaticPointerInputService();

  public constructor(
    private readonly keyboard: KeyboardInputProvider,
    private readonly gamepad: StandardGamepadInputProvider,
    private readonly pointerProvider: PointerInputProvider,
    private readonly settings: InputSettingsProvider,
  ) {}

  public get pointer(): PointerInputService {
    return this.pointerState;
  }

  public poll(): void {
    this.gamepad.poll();
    const mappings = this.settings().keyboard;
    const nextHeld = new Set<string>();
    const nextPressed = new Set<string>();
    const nextReleased = new Set<string>();

    for (const player of [1, 2, 3, 4] as const) {
      for (const action of LOGICAL_ACTIONS) {
        const key = actionKey(player, action);
        const codes = keyboardCodesForAction(mappings, player, action);
        const keyboardHeld = codes.some((code) => this.keyboard.isHeld(code));
        const keyboardPressed = codes.some((code) => this.keyboard.wasPressed(code));
        const keyboardReleased = codes.some((code) => this.keyboard.wasReleased(code));
        const gamepadHeld = this.gamepad.isHeld(player, action);
        const gamepadPressed = this.gamepad.wasPressed(player, action);
        const gamepadReleased = this.gamepad.wasReleased(player, action);
        const currentHeld = keyboardHeld || gamepadHeld;
        const previousHeld = this.held.has(key);

        if (currentHeld) {
          nextHeld.add(key);
        }
        if (!previousHeld && (currentHeld || keyboardPressed || gamepadPressed)) {
          nextPressed.add(key);
        }
        if (!currentHeld && (previousHeld || keyboardReleased || gamepadReleased)) {
          nextReleased.add(key);
        }
      }
    }

    this.held = nextHeld;
    this.pressed = nextPressed;
    this.released = nextReleased;
    this.pointerState.set(this.pointerProvider.consumeFrame());
    this.keyboard.clearEdges();
  }

  public isHeld(player: number, action: LogicalAction): boolean {
    return isPlayerNumber(player) && this.held.has(actionKey(player, action));
  }

  public wasPressed(player: number, action: LogicalAction): boolean {
    return isPlayerNumber(player) && this.pressed.has(actionKey(player, action));
  }

  public wasReleased(player: number, action: LogicalAction): boolean {
    return isPlayerNumber(player) && this.released.has(actionKey(player, action));
  }

  public reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.keyboard.reset();
    this.gamepad.reset();
    this.pointerProvider.reset();
    this.pointerState.set({
      position: null,
      inside: false,
      primaryHeld: false,
      primaryPressed: false,
      primaryReleased: false,
    });
  }
}
