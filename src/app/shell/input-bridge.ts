import {
  StaticPointerInputService,
  type InputService,
  type LogicalAction,
  type PointerInputService,
} from "../../engine/index.js";

export class ShellGameInputBridge implements InputService {
  private delegate: InputService | null = null;
  private readonly fallbackPointer = new StaticPointerInputService();

  public get pointer(): PointerInputService {
    return this.delegate?.pointer ?? this.fallbackPointer;
  }

  public get attached(): boolean {
    return this.delegate !== null;
  }

  public attach(input: InputService): void {
    this.delegate = input;
  }

  public detach(input: InputService): void {
    if (this.delegate === input) {
      this.delegate = null;
      this.resetFallbackPointer();
    }
  }

  public isHeld(player: number, action: LogicalAction): boolean {
    return this.delegate?.isHeld(player, action) ?? false;
  }

  public wasPressed(player: number, action: LogicalAction): boolean {
    return this.delegate?.wasPressed(player, action) ?? false;
  }

  public wasReleased(player: number, action: LogicalAction): boolean {
    return this.delegate?.wasReleased(player, action) ?? false;
  }

  public reset(): void {
    this.delegate?.reset();
    this.resetFallbackPointer();
  }

  private resetFallbackPointer(): void {
    this.fallbackPointer.set({
      position: null,
      inside: false,
      primaryHeld: false,
      primaryPressed: false,
      primaryReleased: false,
    });
  }
}
