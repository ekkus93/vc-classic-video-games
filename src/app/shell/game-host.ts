import {
  ActiveGameRuntime,
  type GameModule,
  type GameRenderer,
  type GameServices,
  type GameStartOptions,
} from "../../engine/index.js";

export type GameLaunchPhase = "loading" | "ready" | "running";
export type GameLaunchPhaseReporter = (phase: GameLaunchPhase) => void;

export interface GameRunTimingPort {
  resetForNewRun(): void;
}

export interface ShellGameHost {
  launch(
    module: GameModule,
    options: GameStartOptions,
    reportPhase?: GameLaunchPhaseReporter,
  ): Promise<void>;
  pause(): void;
  resume(): void;
  restart(): Promise<void>;
  exit(): void;
}

export type GameServicesFactory = (
  module: GameModule,
  options: GameStartOptions,
) => GameServices | Promise<GameServices>;

export type GameHostErrorReporter = (
  message: string,
  error: unknown,
) => void;

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(`${fallback}: ${String(error)}`);
}

const NOOP_TIMING_PORT: GameRunTimingPort = Object.freeze({
  resetForNewRun: () => undefined,
});

/**
 * Owns the P2 game lifecycle for the shell. P7 attaches its P3 frame driver to
 * update/render; pause/restart/exit semantics are already centralized here.
 */
export class LifecycleGameHost implements ShellGameHost {
  private runtime: ActiveGameRuntime | null = null;
  private services: GameServices | null = null;
  private module: GameModule | null = null;
  private options: GameStartOptions | null = null;

  public constructor(
    private readonly createServices: GameServicesFactory,
    private readonly reportError: GameHostErrorReporter = () => undefined,
    private readonly timing: GameRunTimingPort = NOOP_TIMING_PORT,
  ) {}

  public async launch(
    module: GameModule,
    options: GameStartOptions,
    reportPhase: GameLaunchPhaseReporter = () => undefined,
  ): Promise<void> {
    this.exit();
    reportPhase("loading");

    const services = await this.createServices(module, options);
    services.rng.reset(options.seed);
    const runtime = this.createRuntime(services);

    this.runtime = runtime;
    this.services = services;
    this.module = module;
    this.options = Object.freeze({ ...options });

    await runtime.load(module);
    this.requireState("ready", "load game");
    reportPhase("ready");

    await runtime.start(options);
    this.requireState("running", "start game");
    reportPhase("running");
  }

  public pause(): void {
    const runtime = this.requireRuntime("pause");
    runtime.pause();
    this.requireState("paused", "pause game");
    this.services?.audio.pauseAll();
  }

  public resume(): void {
    const runtime = this.requireRuntime("resume");
    runtime.resume();
    this.requireState("running", "resume game");
    this.services?.audio.resumeAll();
  }

  public async restart(): Promise<void> {
    const runtime = this.requireRuntime("restart");
    const services = this.services;
    const module = this.module;
    const options = this.options;
    if (services === null || module === null || options === null) {
      throw new Error("Cannot restart without a complete active game run");
    }

    // A shell restart is deliberately stronger than GameInstance.reset(): the
    // old instance is destroyed, all game-owned audio is stopped by the runtime,
    // transient device state, seeded RNG, and fixed-step timing are cleared, and
    // module.create is invoked again so entities/simulation timers cannot leak.
    runtime.destroy();
    services.input.reset();
    services.rng.reset(options.seed);
    this.timing.resetForNewRun();

    await runtime.load(module);
    this.requireState("ready", "reload game for restart");
    await runtime.start(options);
    this.requireState("running", "restart game");
    services.audio.resumeAll();
  }

  public exit(): void {
    this.runtime?.destroy();
    this.runtime = null;
    this.services = null;
    this.module = null;
    this.options = null;
  }

  public update(dtSeconds: number): void {
    this.runtime?.update(dtSeconds);
  }

  public render(renderer: GameRenderer): void {
    this.runtime?.render(renderer);
  }

  public get activeGameId(): string | null {
    return this.module?.metadata.id ?? null;
  }

  private createRuntime(services: GameServices): ActiveGameRuntime {
    return new ActiveGameRuntime(services, (event) => {
      this.reportError(
        `Game ${event.gameId ?? "unknown"} failed during ${event.phase}`,
        event.error,
      );
    });
  }

  private requireRuntime(operation: string): ActiveGameRuntime {
    if (this.runtime === null) {
      throw new Error(`Cannot ${operation} without an active game`);
    }
    return this.runtime;
  }

  private requireState(
    expected: "ready" | "running" | "paused",
    operation: string,
  ): void {
    const runtime = this.runtime;
    if (runtime === null) {
      throw new Error(`Cannot ${operation} without an active game`);
    }
    if (runtime.state === "error") {
      throw asError(runtime.error, `${operation} failed`);
    }
    if (runtime.state !== expected) {
      throw new Error(
        `${operation} ended in unexpected state ${runtime.state}; expected ${expected}`,
      );
    }
  }
}

export class UnavailableGameHost implements ShellGameHost {
  public launch(
    _module: GameModule,
    _options: GameStartOptions,
    reportPhase: GameLaunchPhaseReporter = () => undefined,
  ): Promise<void> {
    reportPhase("loading");
    return Promise.reject(
      new Error("No playable game runtime is registered yet"),
    );
  }

  public pause(): void {
    throw new Error("No playable game runtime is registered yet");
  }

  public resume(): void {
    throw new Error("No playable game runtime is registered yet");
  }

  public restart(): Promise<void> {
    return Promise.reject(
      new Error("No playable game runtime is registered yet"),
    );
  }

  public exit(): void {}
}
