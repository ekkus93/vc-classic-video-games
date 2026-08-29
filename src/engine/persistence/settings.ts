import {
  createDefaultInputSettings,
  parseInputSettings,
  type InputSettings,
  type InputSettingsStore,
} from "../input/settings.js";
import type { JsonDocumentStore } from "./document-store.js";

export interface AudioSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly muted: boolean;
}

export interface VisualSettings {
  readonly reducedEffects: boolean;
  readonly pixelSmoothing: boolean;
}

export interface GlobalSettings {
  readonly version: 1;
  readonly audio: AudioSettings;
  readonly visual: VisualSettings;
  readonly fullscreen: boolean;
  readonly input: InputSettings;
}

export interface RecoveryWarning {
  readonly scope: "settings" | "scores" | "game-state";
  readonly message: string;
}

export type RecoveryReporter = (warning: RecoveryWarning) => void;

export class GlobalSettingsValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GlobalSettingsValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVolume(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new GlobalSettingsValidationError(`${path} must be a finite number in [0, 1]`);
  }
  return value;
}

function parseBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new GlobalSettingsValidationError(`${path} must be a boolean`);
  }
  return value;
}

export function createDefaultGlobalSettings(): GlobalSettings {
  return Object.freeze({
    version: 1,
    audio: Object.freeze({
      masterVolume: 1,
      musicVolume: 0.8,
      effectsVolume: 1,
      muted: false,
    }),
    visual: Object.freeze({ reducedEffects: false, pixelSmoothing: false }),
    fullscreen: true,
    input: createDefaultInputSettings(),
  });
}

export function parseGlobalSettings(value: unknown): GlobalSettings {
  if (!isRecord(value) || value.version !== 1) {
    throw new GlobalSettingsValidationError("settings version must be 1");
  }
  if (!isRecord(value.audio)) {
    throw new GlobalSettingsValidationError("audio must be an object");
  }
  if (!isRecord(value.visual)) {
    throw new GlobalSettingsValidationError("visual must be an object");
  }

  return Object.freeze({
    version: 1,
    audio: Object.freeze({
      masterVolume: parseVolume(value.audio.masterVolume, "audio.masterVolume"),
      musicVolume: parseVolume(value.audio.musicVolume, "audio.musicVolume"),
      effectsVolume: parseVolume(value.audio.effectsVolume, "audio.effectsVolume"),
      muted: parseBoolean(value.audio.muted, "audio.muted"),
    }),
    visual: Object.freeze({
      reducedEffects: parseBoolean(value.visual.reducedEffects, "visual.reducedEffects"),
      pixelSmoothing: parseBoolean(value.visual.pixelSmoothing, "visual.pixelSmoothing"),
    }),
    fullscreen: parseBoolean(value.fullscreen, "fullscreen"),
    input: parseInputSettings(value.input),
  });
}

export class GlobalSettingsRepository {
  public constructor(
    private readonly documents: JsonDocumentStore,
    private readonly reportRecovery: RecoveryReporter,
  ) {}

  public async load(): Promise<GlobalSettings> {
    const raw = await this.documents.load("settings");
    if (raw === null) {
      return createDefaultGlobalSettings();
    }
    try {
      return parseGlobalSettings(JSON.parse(raw) as unknown);
    } catch (error) {
      this.reportRecovery({
        scope: "settings",
        message: `Stored settings were invalid and defaults were restored: ${error instanceof Error ? error.message : String(error)}`,
      });
      return createDefaultGlobalSettings();
    }
  }

  public save(settings: GlobalSettings): Promise<void> {
    const validated = parseGlobalSettings(settings);
    return this.documents.save("settings", JSON.stringify(validated));
  }
}

export class PersistentInputSettingsStore implements InputSettingsStore {
  public constructor(private readonly settings: GlobalSettingsRepository) {}

  public async load(): Promise<unknown | null> {
    return (await this.settings.load()).input;
  }

  public async save(input: InputSettings): Promise<void> {
    const current = await this.settings.load();
    await this.settings.save({ ...current, input: parseInputSettings(input) });
  }
}
