import type { AssetService } from "../game/services.js";
import { parseAssetManifest, type AssetManifest, type AssetManifestEntry } from "./manifest.js";

export type AssetValue = ArrayBuffer | unknown;

export interface AssetFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
}

export type AssetFetcher = (path: string) => Promise<AssetFetchResponse>;

export class RequiredAssetLoadError extends Error {
  public constructor(public readonly assetId: string, message: string) {
    super(message);
    this.name = "RequiredAssetLoadError";
  }
}

export class AssetCache implements AssetService {
  private readonly values = new Map<string, AssetValue>();
  private manifest: AssetManifest | null = null;

  public constructor(private readonly fetcher: AssetFetcher) {}

  public has(assetId: string): boolean {
    return this.values.has(assetId);
  }

  public get<T = AssetValue>(assetId: string): T | null {
    return (this.values.get(assetId) as T | undefined) ?? null;
  }

  public async preload(rawManifest: unknown): Promise<AssetManifest> {
    const manifest = parseAssetManifest(rawManifest);
    const staged = new Map<string, AssetValue>();

    for (const entry of manifest.assets) {
      try {
        const value = await this.loadEntry(entry);
        staged.set(entry.id, value);
      } catch (error) {
        if (entry.required) {
          throw new RequiredAssetLoadError(
            entry.id,
            `Required asset ${entry.id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    this.values.clear();
    for (const [id, value] of staged) {
      this.values.set(id, value);
    }
    this.manifest = manifest;
    return manifest;
  }

  public clear(): void {
    this.values.clear();
    this.manifest = null;
  }

  public get loadedManifest(): AssetManifest | null {
    return this.manifest;
  }

  private async loadEntry(entry: AssetManifestEntry): Promise<AssetValue> {
    const response = await this.fetcher(entry.path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return entry.type === "json" ? response.json() : response.arrayBuffer();
  }
}

export function browserAssetFetcher(path: string): Promise<AssetFetchResponse> {
  return fetch(path) as Promise<AssetFetchResponse>;
}
