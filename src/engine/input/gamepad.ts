import {
  LOGICAL_ACTIONS,
  type LogicalAction,
  type PlayerNumber,
} from "./actions.js";

export interface GamepadButtonLike {
  readonly pressed: boolean;
  readonly value: number;
}

export interface GamepadLike {
  readonly index: number;
  readonly id: string;
  readonly connected: boolean;
  readonly mapping: string;
  readonly buttons: readonly GamepadButtonLike[];
  readonly axes: readonly number[];
}

export interface GamepadSource {
  getGamepads(): readonly (GamepadLike | null)[];
}

export interface GamepadAssignment {
  readonly player: PlayerNumber;
  readonly gamepadIndex: number;
}

const MAX_PLAYERS = 4;
const DEFAULT_DEAD_ZONE = 0.2;
const DIGITAL_AXIS_THRESHOLD = 0.5;

function actionKey(player: PlayerNumber, action: LogicalAction): string {
  return `${player}:${action}`;
}

function asPlayerNumber(value: number): PlayerNumber | null {
  return Number.isInteger(value) && value >= 1 && value <= MAX_PLAYERS
    ? (value as PlayerNumber)
    : null;
}

export function normalizeGamepadAxis(
  value: number,
  deadZone = DEFAULT_DEAD_ZONE,
): number {
  if (!Number.isFinite(deadZone) || deadZone < 0 || deadZone >= 1) {
    throw new RangeError("deadZone must be a finite value in [0, 1)");
  }

  const clamped = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadZone) {
    return 0;
  }

  const normalized = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(clamped) * normalized;
}

export class BrowserGamepadSource implements GamepadSource {
  public constructor(private readonly browserNavigator: Navigator = navigator) {}

  public getGamepads(): readonly (GamepadLike | null)[] {
    return Array.from(this.browserNavigator.getGamepads());
  }
}

export class GamepadAssignmentManager {
  private readonly playerByIndex = new Map<number, PlayerNumber>();

  public sync(gamepads: readonly (GamepadLike | null)[]): void {
    const connected = new Set<number>();
    for (const gamepad of gamepads) {
      if (gamepad?.connected === true) {
        connected.add(gamepad.index);
      }
    }

    for (const index of [...this.playerByIndex.keys()]) {
      if (!connected.has(index)) {
        this.playerByIndex.delete(index);
      }
    }

    const connectedPads = gamepads
      .filter((gamepad): gamepad is GamepadLike => gamepad?.connected === true)
      .sort((left, right) => left.index - right.index);

    for (const gamepad of connectedPads) {
      if (this.playerByIndex.has(gamepad.index)) {
        continue;
      }
      const player = this.firstAvailablePlayer();
      if (player !== null) {
        this.playerByIndex.set(gamepad.index, player);
      }
    }
  }

  public assign(gamepadIndex: number, player: PlayerNumber): void {
    for (const [index, assignedPlayer] of this.playerByIndex) {
      if (assignedPlayer === player) {
        this.playerByIndex.delete(index);
      }
    }
    this.playerByIndex.set(gamepadIndex, player);
  }

  public playerForGamepad(gamepadIndex: number): PlayerNumber | null {
    return this.playerByIndex.get(gamepadIndex) ?? null;
  }

  public gamepadForPlayer(player: PlayerNumber): number | null {
    for (const [index, assignedPlayer] of this.playerByIndex) {
      if (assignedPlayer === player) {
        return index;
      }
    }
    return null;
  }

  public assignments(): readonly GamepadAssignment[] {
    return Object.freeze(
      [...this.playerByIndex.entries()]
        .map(([gamepadIndex, player]) => ({ player, gamepadIndex }))
        .sort((left, right) => left.player - right.player),
    );
  }

  public reset(): void {
    this.playerByIndex.clear();
  }

  private firstAvailablePlayer(): PlayerNumber | null {
    const used = new Set(this.playerByIndex.values());
    for (let value = 1; value <= MAX_PLAYERS; value += 1) {
      const player = asPlayerNumber(value);
      if (player !== null && !used.has(player)) {
        return player;
      }
    }
    return null;
  }
}

export interface NormalizedGamepadAxes {
  readonly x: number;
  readonly y: number;
}

export class StandardGamepadInputProvider {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private axesByPlayer = new Map<PlayerNumber, NormalizedGamepadAxes>();

  public constructor(
    private readonly source: GamepadSource,
    public readonly assignments = new GamepadAssignmentManager(),
    private readonly deadZone = DEFAULT_DEAD_ZONE,
  ) {}

  public poll(): void {
    const gamepads = this.source.getGamepads();
    this.assignments.sync(gamepads);

    const nextHeld = new Set<string>();
    const nextAxes = new Map<PlayerNumber, NormalizedGamepadAxes>();

    for (const gamepad of gamepads) {
      if (gamepad?.connected !== true) {
        continue;
      }
      const player = this.assignments.playerForGamepad(gamepad.index);
      if (player === null) {
        continue;
      }

      const x = normalizeGamepadAxis(gamepad.axes[0] ?? 0, this.deadZone);
      const y = normalizeGamepadAxis(gamepad.axes[1] ?? 0, this.deadZone);
      nextAxes.set(player, { x, y });

      const buttonPressed = (index: number): boolean =>
        gamepad.buttons[index]?.pressed === true;
      const setHeld = (action: LogicalAction, held: boolean): void => {
        if (held) {
          nextHeld.add(actionKey(player, action));
        }
      };

      setHeld("up", buttonPressed(12) || y <= -DIGITAL_AXIS_THRESHOLD);
      setHeld("down", buttonPressed(13) || y >= DIGITAL_AXIS_THRESHOLD);
      setHeld("left", buttonPressed(14) || x <= -DIGITAL_AXIS_THRESHOLD);
      setHeld("right", buttonPressed(15) || x >= DIGITAL_AXIS_THRESHOLD);
      setHeld("action-1", buttonPressed(0));
      setHeld("action-2", buttonPressed(1));
      setHeld("back", buttonPressed(1) || buttonPressed(8));
      setHeld("start", buttonPressed(9));
      setHeld("pause", buttonPressed(9));
    }

    const nextPressed = new Set<string>();
    const nextReleased = new Set<string>();
    for (const key of nextHeld) {
      if (!this.held.has(key)) {
        nextPressed.add(key);
      }
    }
    for (const key of this.held) {
      if (!nextHeld.has(key)) {
        nextReleased.add(key);
      }
    }

    this.held = nextHeld;
    this.pressed = nextPressed;
    this.released = nextReleased;
    this.axesByPlayer = nextAxes;
  }

  public isHeld(player: PlayerNumber, action: LogicalAction): boolean {
    return this.held.has(actionKey(player, action));
  }

  public wasPressed(player: PlayerNumber, action: LogicalAction): boolean {
    return this.pressed.has(actionKey(player, action));
  }

  public wasReleased(player: PlayerNumber, action: LogicalAction): boolean {
    return this.released.has(actionKey(player, action));
  }

  public axes(player: PlayerNumber): NormalizedGamepadAxes {
    return this.axesByPlayer.get(player) ?? { x: 0, y: 0 };
  }

  public reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.axesByPlayer.clear();
    this.assignments.reset();
  }
}

export function standardGamepadActions(): readonly LogicalAction[] {
  return LOGICAL_ACTIONS;
}
