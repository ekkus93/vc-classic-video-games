import type { InputService } from "../game/services.js";

export type ShellInputContext =
  | "launcher"
  | "pre-game"
  | "running"
  | "paused"
  | "settings";

export type ShellNavigationCommand =
  | "up"
  | "down"
  | "left"
  | "right"
  | "activate"
  | "back"
  | "pause";

const MENU_CONTEXTS: ReadonlySet<ShellInputContext> = new Set([
  "launcher",
  "pre-game",
  "paused",
  "settings",
]);
const SHELL_PLAYERS = [1, 2, 3, 4] as const;

export class ShellInputRouter {
  public commands(
    input: InputService,
    context: ShellInputContext,
  ): readonly ShellNavigationCommand[] {
    const commands: ShellNavigationCommand[] = [];
    const pressed = (action: Parameters<InputService["wasPressed"]>[1]): boolean =>
      SHELL_PLAYERS.some((player) => input.wasPressed(player, action));

    if (context === "running") {
      if (pressed("pause") || pressed("start")) {
        commands.push("pause");
      }
      return Object.freeze(commands);
    }

    if (!MENU_CONTEXTS.has(context)) {
      return Object.freeze(commands);
    }

    for (const action of ["up", "down", "left", "right"] as const) {
      if (pressed(action)) {
        commands.push(action);
      }
    }

    if (pressed("action-1") || (context !== "paused" && pressed("start"))) {
      commands.push("activate");
    }
    if (
      pressed("action-2") ||
      pressed("back") ||
      (context === "paused" && (pressed("pause") || pressed("start")))
    ) {
      commands.push("back");
    }

    return Object.freeze(commands);
  }
}

export function moveMenuSelection(
  currentIndex: number,
  itemCount: number,
  command: ShellNavigationCommand,
): number {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new RangeError("itemCount must be a positive integer");
  }
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= itemCount) {
    throw new RangeError("currentIndex must reference a menu item");
  }

  if (command === "up" || command === "left") {
    return (currentIndex - 1 + itemCount) % itemCount;
  }
  if (command === "down" || command === "right") {
    return (currentIndex + 1) % itemCount;
  }
  return currentIndex;
}
