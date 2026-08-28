const NON_ZERO_FALLBACK_SEED = 0x6d2b79f5;

/**
 * Small deterministic PRNG primitive used by the foundation smoke test.
 *
 * Game-facing RNG services will wrap deterministic primitives instead of
 * allowing modules to depend on Math.random().
 */
export class XorShift32 {
  private state: number;

  public constructor(seed: number) {
    const normalized = seed >>> 0;
    this.state = normalized === 0 ? NON_ZERO_FALLBACK_SEED : normalized;
  }

  public nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }
}
