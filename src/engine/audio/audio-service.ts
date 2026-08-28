import type { AudioService } from "../game/services.js";

export type AudioBus = "music" | "sfx";

export interface AudioBufferResolver {
  getAudioBuffer(assetId: string): AudioBuffer | null;
}

export interface SharedAudioSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly muted: boolean;
}

export type AudioContextFactory = () => AudioContext;

interface ActiveSource {
  readonly source: AudioBufferSourceNode;
  readonly assetId: string;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("volume must be finite");
  }
  return Math.max(0, Math.min(1, value));
}

export class SharedWebAudioService implements AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly active = new Set<ActiveSource>();
  private settings: SharedAudioSettings = {
    masterVolume: 1,
    musicVolume: 0.8,
    effectsVolume: 1,
    muted: false,
  };

  public constructor(
    private readonly assets: AudioBufferResolver,
    private readonly createContext: AudioContextFactory = () => new AudioContext(),
  ) {}

  public get isUnlocked(): boolean {
    return this.context !== null && this.context.state === "running";
  }

  public async unlock(): Promise<boolean> {
    if (this.context === null) {
      const context = this.createContext();
      this.context = context;
      this.masterGain = context.createGain();
      this.musicGain = context.createGain();
      this.sfxGain = context.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(context.destination);
      this.applySettings();
    }
    if (this.context.state !== "running") {
      await this.context.resume();
    }
    return this.context.state === "running";
  }

  public playEffect(assetId: string): void {
    this.play(assetId, "sfx", false);
  }

  public playLoop(assetId: string, bus: AudioBus = "music"): void {
    this.play(assetId, bus, true);
  }

  public stop(assetId: string): void {
    for (const active of [...this.active]) {
      if (active.assetId === assetId) {
        active.source.stop();
        this.active.delete(active);
      }
    }
  }

  public pauseAll(): void {
    if (this.context?.state === "running") {
      void this.context.suspend();
    }
  }

  public resumeAll(): void {
    if (this.context?.state === "suspended") {
      void this.context.resume();
    }
  }

  public stopAll(): void {
    for (const active of this.active) {
      active.source.stop();
    }
    this.active.clear();
  }

  public configure(settings: SharedAudioSettings): void {
    this.settings = Object.freeze({
      masterVolume: clampVolume(settings.masterVolume),
      musicVolume: clampVolume(settings.musicVolume),
      effectsVolume: clampVolume(settings.effectsVolume),
      muted: settings.muted,
    });
    this.applySettings();
  }

  private play(assetId: string, bus: AudioBus, loop: boolean): void {
    if (!this.isUnlocked || this.context === null) {
      return;
    }
    const buffer = this.assets.getAudioBuffer(assetId);
    if (buffer === null) {
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(bus === "music" ? this.musicGain! : this.sfxGain!);
    const active: ActiveSource = { source, assetId };
    this.active.add(active);
    source.addEventListener("ended", () => this.active.delete(active), { once: true });
    source.start();
  }

  private applySettings(): void {
    if (this.masterGain === null || this.musicGain === null || this.sfxGain === null) {
      return;
    }
    this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.effectsVolume;
  }
}
