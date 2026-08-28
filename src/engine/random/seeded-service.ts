import type { RandomService } from "../game/services.js";
import { XorShift32 } from "./xorshift32.js";

export class SeededRandomService implements RandomService {
  private generator: XorShift32;

  public constructor(seed: number) {
    this.generator = new XorShift32(seed);
  }

  public nextUint32(): number {
    return this.generator.nextUint32();
  }

  public nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  public reset(seed: number): void {
    this.generator = new XorShift32(seed);
  }
}
