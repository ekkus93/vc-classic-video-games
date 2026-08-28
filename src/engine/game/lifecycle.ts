export type GameLifecycleState =
  | "unloaded"
  | "loading"
  | "ready"
  | "running"
  | "paused"
  | "game-over"
  | "error";

const ALLOWED_TRANSITIONS: Readonly<
  Record<GameLifecycleState, readonly GameLifecycleState[]>
> = Object.freeze({
  unloaded: ["loading", "error"],
  loading: ["ready", "unloaded", "error"],
  ready: ["running", "unloaded", "error"],
  running: ["paused", "ready", "game-over", "unloaded", "error"],
  paused: ["running", "ready", "game-over", "unloaded", "error"],
  "game-over": ["ready", "unloaded", "error"],
  error: ["unloaded"],
});

export class InvalidLifecycleTransitionError extends Error {
  public constructor(from: GameLifecycleState, to: GameLifecycleState) {
    super(`Illegal game lifecycle transition: ${from} -> ${to}`);
    this.name = "InvalidLifecycleTransitionError";
  }
}

export class GameLifecycle {
  private currentState: GameLifecycleState = "unloaded";
  private currentError: unknown = null;

  public get state(): GameLifecycleState {
    return this.currentState;
  }

  public get error(): unknown {
    return this.currentError;
  }

  public canTransition(to: GameLifecycleState): boolean {
    return ALLOWED_TRANSITIONS[this.currentState].includes(to);
  }

  public transition(to: GameLifecycleState): void {
    if (!this.canTransition(to)) {
      throw new InvalidLifecycleTransitionError(this.currentState, to);
    }

    this.currentState = to;
    if (to !== "error") {
      this.currentError = null;
    }
  }

  public fail(error: unknown): void {
    if (this.currentState === "error") {
      this.currentError = error;
      return;
    }
    this.transition("error");
    this.currentError = error;
  }
}
