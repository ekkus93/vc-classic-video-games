export const ASSET_TYPES = ["image", "audio", "json", "font"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface SpriteMetadata {
  readonly frameWidth: number;
  readonly frameHeight: number;
}

export interface AssetManifestEntry {
  readonly id: string;
  readonly path: string;
  readonly type: AssetType;
  readonly required: boolean;
  readonly sprite?: SpriteMetadata;
}

export interface AssetManifest {
  readonly version: 1;
  readonly assets: readonly AssetManifestEntry[];
}

export class AssetManifestValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AssetManifestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    throw new AssetManifestValidationError(`${path} must be a positive integer`);
  }
  return value;
}

export function parseAssetManifest(value: unknown): AssetManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.assets)) {
    throw new AssetManifestValidationError("asset manifest must have version 1 and an assets array");
  }

  const seen = new Set<string>();
  const assets = value.assets.map((raw, index): AssetManifestEntry => {
    if (!isRecord(raw)) {
      throw new AssetManifestValidationError(`assets[${index}] must be an object`);
    }
    if (typeof raw.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/u.test(raw.id)) {
      throw new AssetManifestValidationError(`assets[${index}].id is invalid`);
    }
    if (seen.has(raw.id)) {
      throw new AssetManifestValidationError(`duplicate asset id: ${raw.id}`);
    }
    seen.add(raw.id);
    if (typeof raw.path !== "string" || raw.path.length === 0 || raw.path.startsWith("/") || raw.path.includes("..")) {
      throw new AssetManifestValidationError(`assets[${index}].path must be a relative bundled path`);
    }
    if (typeof raw.type !== "string" || !ASSET_TYPES.some((type) => type === raw.type)) {
      throw new AssetManifestValidationError(`assets[${index}].type is invalid`);
    }
    if (raw.required !== undefined && typeof raw.required !== "boolean") {
      throw new AssetManifestValidationError(`assets[${index}].required must be boolean`);
    }

    let sprite: SpriteMetadata | undefined;
    if (raw.sprite !== undefined) {
      if (!isRecord(raw.sprite)) {
        throw new AssetManifestValidationError(`assets[${index}].sprite must be an object`);
      }
      sprite = Object.freeze({
        frameWidth: positiveInteger(raw.sprite.frameWidth, `assets[${index}].sprite.frameWidth`),
        frameHeight: positiveInteger(raw.sprite.frameHeight, `assets[${index}].sprite.frameHeight`),
      });
    }

    return Object.freeze({
      id: raw.id,
      path: raw.path,
      type: raw.type as AssetType,
      required: raw.required ?? true,
      ...(sprite === undefined ? {} : { sprite }),
    });
  });

  return Object.freeze({ version: 1, assets: Object.freeze(assets) });
}
