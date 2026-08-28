import type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameStartOptions,
} from "./contracts.js";
import { GameLifecycle, type GameLifecycleState } from "./lifecycle.js";
import type { GameServices } from "./services.js";

export type GameRuntimePhase =
  | "create"
  | "start"
  | "update"
  | "render"
  | "pause"
  | "resume"
  | "reset"
  | "destroy";

export interface GameRuntimeErrorEvent {
  readonly phase: GameRuntimePhase;
  readonly gameId: string | null;
  readonly error: unknown;
}

export type GameRuntimeErrorHandler = (event: GameRuntimeErrorEvent) => void;

interface ActiveGame {
  readonly module: GameModule;
  readonly instance: GameInstance;
}

export class NoActiveGameError extends Error {
  public constructor(operation: string) {
    super(`Cannot ${operation} without an active game`);
    this.name = "NoActiveGameError";
  }
}

export class InvalidRuntimeStateError extends Error {
  public constructor(
    operation: string,
    state: GameLifecycleState,
    expected: readonly GameLifecycleState[],
  ) {
    super(
      `Cannot ${operation} while game state is ${state}; expected ${expected.join(
        " or ",
      )}`,
    );
    this.name = "InvalidRuntimeStateError";
  }
}

export class ActiveGameRuntime {
  private readonly lifecycle = new GameLifecycle();
  private active: ActiveGame | null = null;

  public constructor(
    private readonly services: GameServices,
    private readonly onError: GameRuntimeErrorHandler = () => undefined,
  ) {}

  public get state(): GameLifecycleState {
    return this.lifecycle.state;
  }

  public get error(): unknown {
    return this.lifecycle.error;
  }

  public get activeGameId(): string | null {
    return this.active?.module.metadata.id ?? null;
  }

  public async load(module: GameModule): Promise<void> {
    this.releaseActive();
    if (this.lifecycle.state === "error") {
      this.lifecycle.transition("unloaded");
    }
    if (this.lifecycle.state !== "unloaded") {
      this.lifecycle.transition("unloaded");
    }

    this.lifecycle.transition("loading");

    try {
      const instance = module.create(this.services);
      this.active = { module, instance };
      this.lifecycle.transition("ready");
    } catch (error) {
      this.handleFailure("create", module.metadata.id, error);
    }
  }

  public async start(options: GameStartOptions): Promise<void> {
    this.requireState("start", ["ready"]);
    const active = this.requireActive("start");

    try {
      await active.instance.start(options);
      this.lifecycle.transition("running");
    } catch (error) {
      this.handleFailure("start", active.module.metadata.id, error);
    }
  }

  public update(dtSeconds: number): void {
    if (this.lifecycle.state !== "running") {
      return;
    }
    const active = this.requireActive("update");

    try {
      active.instance.update(dtSeconds);
    } catch (error) {
      this.handleFailure("update", active.module.metadata.id, error);
    }
  }

  public render(renderer: GameRenderer): void {
    if (
      this.lifecycle.state === "unloaded" ||
      this.lifecycle.state === "loading" ||
      this.lifecycle.state === "error"
    ) {
      return;
    }
    const active = this.requireActive("render");

    try {
      active.instance.render(renderer);
    } catch (error) {
      this.handleFailure("render", active.module.metadata.id, error);
    }
  }

  public pause(): void {
    this.requireState("pause", ["running"]);
    const active = this.requireActive("pause");

    try {
      active.instance.pause();
      this.lifecycle.transition("paused");
    } catch (error) {
      this.handleFailure("pause", active.module.metadata.id, error);
    }
  }

  public resume(): void {
    this.requireState("resume", ["paused"]);
    const active = this.requireActive("resume");

    try {
      active.instance.resume();
      this.lifecycle.transition("running");
    } catch (error) {
      this.handleFailure("resume", active.module.metadata.id, error);
    }
  }

  public reset(): void {
    this.requireState("reset", ["ready", "running", "paused", "game-over"]);
    const active = this.requireActive("reset");

    try {
      active.instance.reset();
      if (this.lifecycle.state !== "ready") {
        this.lifecycle.transition("ready");
      }
    } catch (error) {
      this.handleFailure("reset", active.module.metadata.id, error);
    }
  }

  public markGameOver(): void {
    this.requireState("mark game over", ["running", "paused"]);
    this.lifecycle.transition("game-over");
  }

  public recover(): void {
    this.requireState("recover", ["error"]);
    this.lifecycle.transition("unloaded");
  }

  public destroy(): void {
    this.releaseActive();
    if (this.lifecycle.state === "error") {
      this.lifecycle.transition("unloaded");
    } else if (this.lifecycle.state !== "unloaded") {
      this.lifecycle.transition("unloaded");
    }
  }

  private requireActive(operation: string): ActiveGame {
    if (this.active === null) {
      throw new NoActiveGameError(operation);
    }
    return this.active;
  }

  private requireState(
    operation: string,
    expected: readonly GameLifecycleState[],
  ): void {
    if (!expected.includes(this.lifecycle.state)) {
      throw new InvalidRuntimeStateError(
        operation,
        this.lifecycle.state,
        expected,
      );
    }
  }

  private releaseActive(): void {
    const active = this.active;
    this.active = null;
    if (active === null) {
      return;
    }

    try {
      active.instance.destroy();
    } catch (error) {
      this.onError({
        phase: "destroy",
        gameId: active.module.metadata.id,
        error,
      });
    } finally {
      this.services.audio.stopAll();
    }
  }

  private handleFailure(
    phase: Exclude<GameRuntimePhase, "destroy">,
    gameId: string,
    error: unknown,
  ): void {
    const active = this.active;
    this.active = null;

    if (active !== null) {
      try {
        active.instance.destroy();
      } catch (destroyError) {
        this.onError({ phase: "destroy", gameId, error: destroyError });
      }
    }
    this.services.audio.stopAll();
    this.lifecycle.fail(error);
    this.onError({ phase, gameId, error });
  }
}
