import {
  LOGICAL_ACTIONS,
  type LogicalAction,
  type PlayerNumber,
} from "./actions.js";

export type KeyboardBindingMap = Readonly<
  Record<LogicalAction, readonly string[]>
>;
export type KeyboardMappings = Readonly<
  Record<PlayerNumber, KeyboardBindingMap>
>;

export interface InputMappingConflict {
  readonly player: PlayerNumber;
  readonly code: string;
  readonly actions: readonly LogicalAction[];
}

function emptyBindings(): Record<LogicalAction, string[]> {
  return {
    up: [],
    down: [],
    left: [],
    right: [],
    "action-1": [],
    "action-2": [],
    start: [],
    pause: [],
    back: [],
  };
}

function defaultPlayerOne(): Record<LogicalAction, string[]> {
  return {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    "action-1": ["KeyZ", "Space"],
    "action-2": ["KeyX", "ShiftLeft"],
    start: ["Enter"],
    pause: ["Escape"],
    back: ["Escape"],
  };
}

function defaultPlayerTwo(): Record<LogicalAction, string[]> {
  return {
    up: ["KeyW"],
    down: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    "action-1": ["KeyF"],
    "action-2": ["KeyG"],
    start: [],
    pause: [],
    back: [],
  };
}

function freezeBindings(
  bindings: Record<LogicalAction, string[]>,
): KeyboardBindingMap {
  for (const action of LOGICAL_ACTIONS) {
    bindings[action] = Object.freeze([...bindings[action]]) as string[];
  }
  return Object.freeze(bindings);
}

export function createDefaultKeyboardMappings(): KeyboardMappings {
  return Object.freeze({
    1: freezeBindings(defaultPlayerOne()),
    2: freezeBindings(defaultPlayerTwo()),
    3: freezeBindings(emptyBindings()),
    4: freezeBindings(emptyBindings()),
  });
}

export function cloneKeyboardMappings(
  mappings: KeyboardMappings,
): Record<PlayerNumber, Record<LogicalAction, string[]>> {
  const clonePlayer = (player: PlayerNumber): Record<LogicalAction, string[]> => {
    const clone = emptyBindings();
    for (const action of LOGICAL_ACTIONS) {
      clone[action] = [...mappings[player][action]];
    }
    return clone;
  };

  return {
    1: clonePlayer(1),
    2: clonePlayer(2),
    3: clonePlayer(3),
    4: clonePlayer(4),
  };
}

export function freezeKeyboardMappings(
  mappings: Record<PlayerNumber, Record<LogicalAction, string[]>>,
): KeyboardMappings {
  return Object.freeze({
    1: freezeBindings(mappings[1]),
    2: freezeBindings(mappings[2]),
    3: freezeBindings(mappings[3]),
    4: freezeBindings(mappings[4]),
  });
}

function sharedBindingIsIntentional(actions: readonly LogicalAction[]): boolean {
  return actions.every((action) => action === "pause" || action === "back");
}

export function findKeyboardMappingConflicts(
  mappings: KeyboardMappings,
): readonly InputMappingConflict[] {
  const conflicts: InputMappingConflict[] = [];

  for (const player of [1, 2, 3, 4] as const) {
    const actionsByCode = new Map<string, LogicalAction[]>();
    for (const action of LOGICAL_ACTIONS) {
      const seenForAction = new Set<string>();
      for (const code of mappings[player][action]) {
        const normalized = code.trim();
        if (normalized.length === 0 || seenForAction.has(normalized)) {
          continue;
        }
        seenForAction.add(normalized);
        const actions = actionsByCode.get(normalized) ?? [];
        actions.push(action);
        actionsByCode.set(normalized, actions);
      }
    }

    for (const [code, actions] of actionsByCode) {
      if (actions.length > 1 && !sharedBindingIsIntentional(actions)) {
        conflicts.push({
          player,
          code,
          actions: Object.freeze([...actions]),
        });
      }
    }
  }

  return Object.freeze(conflicts);
}

export function keyboardCodesForAction(
  mappings: KeyboardMappings,
  player: PlayerNumber,
  action: LogicalAction,
): readonly string[] {
  return mappings[player][action];
}
