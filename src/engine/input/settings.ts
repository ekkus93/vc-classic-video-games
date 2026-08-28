import {
  LOGICAL_ACTIONS,
  isLogicalAction,
  type LogicalAction,
  type PlayerNumber,
} from "./actions.js";
import {
  cloneKeyboardMappings,
  createDefaultKeyboardMappings,
  findKeyboardMappingConflicts,
  freezeKeyboardMappings,
  type KeyboardMappings,
} from "./mappings.js";

export interface InputSettings {
  readonly version: 1;
  readonly keyboard: KeyboardMappings;
}

export interface InputSettingsStore {
  load(): Promise<unknown | null>;
  save(settings: InputSettings): Promise<void>;
}

export type InputSettingsListener = (settings: InputSettings) => void;

export class InputSettingsValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InputSettingsValidationError";
  }
}

export class InputMappingConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InputMappingConflictError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCodes(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new InputSettingsValidationError(`${path} must be an array`);
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new InputSettingsValidationError(
        `${path}[${index}] must be a non-empty keyboard code`,
      );
    }
    const code = entry.trim();
    if (seen.has(code)) {
      throw new InputSettingsValidationError(`${path} must not contain duplicates`);
    }
    seen.add(code);
    result.push(code);
  }
  return result;
}

function parseKeyboardMappings(value: unknown): KeyboardMappings {
  if (!isRecord(value)) {
    throw new InputSettingsValidationError("keyboard must be an object");
  }

  const defaults = createDefaultKeyboardMappings();
  const mutable = cloneKeyboardMappings(defaults);

  for (const player of [1, 2, 3, 4] as const) {
    const playerValue = value[String(player)];
    if (!isRecord(playerValue)) {
      throw new InputSettingsValidationError(`keyboard.${player} must be an object`);
    }

    for (const action of LOGICAL_ACTIONS) {
      mutable[player][action] = parseCodes(
        playerValue[action],
        `keyboard.${player}.${action}`,
      );
    }

    for (const key of Object.keys(playerValue)) {
      if (!isLogicalAction(key)) {
        throw new InputSettingsValidationError(
          `keyboard.${player}.${key} is not a supported logical action`,
        );
      }
    }
  }

  const keyboard = freezeKeyboardMappings(mutable);
  const conflicts = findKeyboardMappingConflicts(keyboard);
  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    if (conflict !== undefined) {
      throw new InputSettingsValidationError(
        `keyboard.${conflict.player}.${conflict.code} conflicts across ${conflict.actions.join(", ")}`,
      );
    }
  }
  return keyboard;
}

export function createDefaultInputSettings(): InputSettings {
  return Object.freeze({
    version: 1,
    keyboard: createDefaultKeyboardMappings(),
  });
}

export function parseInputSettings(value: unknown): InputSettings {
  if (!isRecord(value) || value.version !== 1) {
    throw new InputSettingsValidationError("input settings version must be 1");
  }

  return Object.freeze({
    version: 1,
    keyboard: parseKeyboardMappings(value.keyboard),
  });
}

export class MemoryInputSettingsStore implements InputSettingsStore {
  private value: unknown | null = null;

  public load(): Promise<unknown | null> {
    return Promise.resolve(
      this.value === null ? null : JSON.parse(JSON.stringify(this.value)),
    );
  }

  public save(settings: InputSettings): Promise<void> {
    this.value = JSON.parse(JSON.stringify(settings));
    return Promise.resolve();
  }
}

export class InputSettingsController {
  private settings = createDefaultInputSettings();
  private readonly listeners = new Set<InputSettingsListener>();

  public constructor(private readonly store: InputSettingsStore) {}

  public get current(): InputSettings {
    return this.settings;
  }

  public async load(): Promise<InputSettings> {
    const stored = await this.store.load();
    this.settings = stored === null ? createDefaultInputSettings() : parseInputSettings(stored);
    this.notify();
    return this.settings;
  }

  public async setKeyboardBinding(
    player: PlayerNumber,
    action: LogicalAction,
    codes: readonly string[],
  ): Promise<InputSettings> {
    const mutable = cloneKeyboardMappings(this.settings.keyboard);
    mutable[player][action] = [...codes];
    const keyboard = freezeKeyboardMappings(mutable);
    const conflicts = findKeyboardMappingConflicts(keyboard);
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      if (conflict !== undefined) {
        throw new InputMappingConflictError(
          `Keyboard code ${conflict.code} conflicts for player ${conflict.player}: ${conflict.actions.join(", ")}`,
        );
      }
    }

    this.settings = parseInputSettings({ version: 1, keyboard });
    await this.store.save(this.settings);
    this.notify();
    return this.settings;
  }

  public async resetDefaults(): Promise<InputSettings> {
    this.settings = createDefaultInputSettings();
    await this.store.save(this.settings);
    this.notify();
    return this.settings;
  }

  public subscribe(listener: InputSettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}
