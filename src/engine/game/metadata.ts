const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DIFFICULTY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MIN_LOGICAL_DIMENSION = 64;
const MAX_LOGICAL_DIMENSION = 4096;
const MAX_PLAYERS = 4;

export const INPUT_KINDS = [
  "keyboard",
  "gamepad",
  "pointer",
  "touch",
] as const;

export type InputKind = (typeof INPUT_KINDS)[number];

export interface DifficultyDefinition {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface ControlDescription {
  readonly action: string;
  readonly label: string;
  readonly description?: string;
}

export interface GameMetadata {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: number;
  readonly players: readonly number[];
  readonly supportedInputs: readonly InputKind[];
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly defaultDifficulty: string;
  readonly difficulties: readonly DifficultyDefinition[];
  readonly controls: readonly ControlDescription[];
  readonly assetManifest: string;
}

export class GameMetadataValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GameMetadataValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new GameMetadataValidationError(`${path} must be an object`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GameMetadataValidationError(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireString(value, path);
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new GameMetadataValidationError(`${path} must be a positive integer`);
  }
  return value;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new GameMetadataValidationError(`${path} must be an array`);
  }
  return value;
}

function ensureUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) {
    throw new GameMetadataValidationError(`${path} must not contain duplicates`);
  }
}

function parseDifficulty(value: unknown, index: number): DifficultyDefinition {
  const record = requireRecord(value, `difficulties[${index}]`);
  const id = requireString(record.id, `difficulties[${index}].id`);
  if (!DIFFICULTY_ID_PATTERN.test(id)) {
    throw new GameMetadataValidationError(
      `difficulties[${index}].id must use lowercase kebab-case`,
    );
  }

  const label = requireString(record.label, `difficulties[${index}].label`);
  const description = optionalString(
    record.description,
    `difficulties[${index}].description`,
  );

  return description === undefined ? { id, label } : { id, label, description };
}

function parseControl(value: unknown, index: number): ControlDescription {
  const record = requireRecord(value, `controls[${index}]`);
  const action = requireString(record.action, `controls[${index}].action`);
  const label = requireString(record.label, `controls[${index}].label`);
  const description = optionalString(
    record.description,
    `controls[${index}].description`,
  );

  return description === undefined
    ? { action, label }
    : { action, label, description };
}

function parseAssetManifest(value: unknown): string {
  const manifest = requireString(value, "assetManifest");
  const normalized = manifest.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (
    normalized.startsWith("/") ||
    segments.includes("..") ||
    !normalized.endsWith(".json")
  ) {
    throw new GameMetadataValidationError(
      "assetManifest must be a relative JSON path without parent traversal",
    );
  }

  return normalized;
}

export function parseGameMetadata(value: unknown): GameMetadata {
  const record = requireRecord(value, "metadata");
  const id = requireString(record.id, "id");
  if (!GAME_ID_PATTERN.test(id)) {
    throw new GameMetadataValidationError("id must use lowercase kebab-case");
  }

  const title = requireString(record.title, "title");
  const description = requireString(record.description, "description");
  const version = requirePositiveInteger(record.version, "version");

  const players = requireArray(record.players, "players").map((player, index) => {
    const parsed = requirePositiveInteger(player, `players[${index}]`);
    if (parsed > MAX_PLAYERS) {
      throw new GameMetadataValidationError(
        `players[${index}] must be at most ${MAX_PLAYERS}`,
      );
    }
    return parsed;
  });
  if (players.length === 0) {
    throw new GameMetadataValidationError("players must not be empty");
  }
  if (new Set(players).size !== players.length) {
    throw new GameMetadataValidationError("players must not contain duplicates");
  }

  const supportedInputs = requireArray(
    record.supportedInputs,
    "supportedInputs",
  ).map((input, index) => {
    if (
      typeof input !== "string" ||
      !INPUT_KINDS.includes(input as InputKind)
    ) {
      throw new GameMetadataValidationError(
        `supportedInputs[${index}] is not a supported input kind`,
      );
    }
    return input as InputKind;
  });
  if (supportedInputs.length === 0) {
    throw new GameMetadataValidationError("supportedInputs must not be empty");
  }
  ensureUnique(supportedInputs, "supportedInputs");

  const logicalWidth = requirePositiveInteger(record.logicalWidth, "logicalWidth");
  const logicalHeight = requirePositiveInteger(
    record.logicalHeight,
    "logicalHeight",
  );
  for (const [name, dimension] of [
    ["logicalWidth", logicalWidth],
    ["logicalHeight", logicalHeight],
  ] as const) {
    if (
      dimension < MIN_LOGICAL_DIMENSION ||
      dimension > MAX_LOGICAL_DIMENSION
    ) {
      throw new GameMetadataValidationError(
        `${name} must be between ${MIN_LOGICAL_DIMENSION} and ${MAX_LOGICAL_DIMENSION}`,
      );
    }
  }

  const difficulties = requireArray(record.difficulties, "difficulties").map(
    parseDifficulty,
  );
  if (difficulties.length === 0) {
    throw new GameMetadataValidationError("difficulties must not be empty");
  }
  ensureUnique(
    difficulties.map((difficulty) => difficulty.id),
    "difficulties",
  );

  const defaultDifficulty = requireString(
    record.defaultDifficulty,
    "defaultDifficulty",
  );
  if (!difficulties.some((difficulty) => difficulty.id === defaultDifficulty)) {
    throw new GameMetadataValidationError(
      "defaultDifficulty must reference a declared difficulty",
    );
  }

  const controls = requireArray(record.controls, "controls").map(parseControl);
  const assetManifest = parseAssetManifest(record.assetManifest);

  return Object.freeze({
    id,
    title,
    description,
    version,
    players: Object.freeze([...players]),
    supportedInputs: Object.freeze([...supportedInputs]),
    logicalWidth,
    logicalHeight,
    defaultDifficulty,
    difficulties: Object.freeze(difficulties.map((entry) => Object.freeze(entry))),
    controls: Object.freeze(controls.map((entry) => Object.freeze(entry))),
    assetManifest,
  });
}

export function defineGameMetadata(metadata: GameMetadata): GameMetadata {
  return parseGameMetadata(metadata);
}
