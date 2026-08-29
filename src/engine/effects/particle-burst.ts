import type { GameRenderer } from "../render/renderer.js";

export interface BurstParticle {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ageSeconds: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}

/**
 * One burst: where it happens and what it looks like. `count` is a request, not a promise -- the
 * field's `maxParticles` cap wins, so a burst fired into a full field is trimmed or dropped.
 */
export interface ParticleBurst {
  readonly x: number;
  readonly y: number;
  readonly count: number;
  readonly speed: number;
  readonly lifetimeSeconds: number;
  readonly radius: number;
  readonly color: string;
}

/**
 * CR2-010: `ParticleBurst` minus its origin. Several games define a per-event "what does this
 * burst look like" style object ahead of time (a lookup table of named bursts, say) and only
 * supply `x`/`y` at the call site where the burst actually happens; this is that shape, shared so
 * each game doesn't redeclare an identical local `BurstStyle`/`Burst` interface. Purely a type --
 * a game using it still owns constructing its own `ParticleBurst` (`{ x, y, ...style }`) and
 * calling `ParticleBurstField.burst` itself.
 */
export type ParticleBurstStyle = Omit<ParticleBurst, "x" | "y">;

/**
 * The knobs games actually differ on. Every default matches the shape most games already used, so
 * a game only names what it does differently. None of these change what a burst *is* -- a ring of
 * `count` particles fanned around a rotating phase, each at a quantized fraction of `speed` -- they
 * only change the constants of the deterministic jitter, which is what keeps repeated bursts from
 * looking stamped out of the same mould.
 */
export interface ParticleBurstFieldOptions {
  /** Hard cap on live particles; a burst never grows the field past this. */
  readonly maxParticles: number;
  /** Turns of ring rotation added per burst, wrapped to one turn. */
  readonly phaseStep?: number;
  /** Slowest particle in a burst, as a fraction of the burst's speed. */
  readonly speedScaleBase?: number;
  /** Fraction of speed added per jitter step. */
  readonly speedScaleStep?: number;
  /** Number of distinct jitter steps (the modulus). */
  readonly speedScaleSteps?: number;
  /** How far the jitter walks per particle index. */
  readonly indexStride?: number;
  /** How far the jitter walks per burst. */
  readonly serialStride?: number;
  /**
   * Whether a burst that spawns nothing (a full field) still advances the ring phase. Off means a
   * dropped burst leaves the next one looking exactly as it would have.
   */
  readonly advanceSerialOnDroppedBurst?: boolean;
}

const DEFAULTS = Object.freeze({
  phaseStep: 0.38196601125,
  speedScaleBase: 0.7,
  speedScaleStep: 0.1,
  speedScaleSteps: 4,
  indexStride: 1,
  serialStride: 1,
  advanceSerialOnDroppedBurst: false,
});

function requireDelta(dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
    throw new RangeError("dtSeconds must be a non-negative finite number");
  }
}

/**
 * The bounded particle-burst field every game's `effects.ts` needs: fan a ring of particles out of
 * a point, drift them at constant velocity, retire them at their lifetime, and never exceed a
 * fixed cap no matter how many bursts a frame asks for.
 *
 * Bursts are deterministic -- no RNG -- so a replayed run draws the same particles, which is what
 * lets games stay seed-reproducible while still looking lively.
 */
export class ParticleBurstField {
  private particlesValue: readonly BurstParticle[] = Object.freeze([]);
  private serial = 0;
  private readonly settings: Required<ParticleBurstFieldOptions>;

  public constructor(options: ParticleBurstFieldOptions) {
    if (
      !Number.isSafeInteger(options.maxParticles) ||
      options.maxParticles < 0
    ) {
      throw new RangeError("maxParticles must be a non-negative safe integer");
    }
    this.settings = Object.freeze({ ...DEFAULTS, ...options });
    if (
      !Number.isSafeInteger(this.settings.speedScaleSteps) ||
      this.settings.speedScaleSteps < 1
    ) {
      throw new RangeError("speedScaleSteps must be a positive safe integer");
    }
  }

  public get particles(): readonly BurstParticle[] {
    return this.particlesValue;
  }

  public get count(): number {
    return this.particlesValue.length;
  }

  public burst(burst: ParticleBurst): void {
    const available = Math.max(0, this.settings.maxParticles - this.particlesValue.length);
    const count = Math.min(burst.count, available);
    if (count <= 0) {
      if (this.settings.advanceSerialOnDroppedBurst) {
        this.serial += 1;
      }
      return;
    }

    const phase = (this.serial * this.settings.phaseStep) % 1;
    this.serial += 1;
    const next = [...this.particlesValue];
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * (phase + index / count);
      const jitter =
        (index * this.settings.indexStride + this.serial * this.settings.serialStride) %
        this.settings.speedScaleSteps;
      const speed = burst.speed * (this.settings.speedScaleBase + jitter * this.settings.speedScaleStep);
      next.push(
        Object.freeze({
          x: burst.x,
          y: burst.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ageSeconds: 0,
          lifetimeSeconds: burst.lifetimeSeconds,
          radius: burst.radius,
          color: burst.color,
        }),
      );
    }
    this.particlesValue = Object.freeze(next);
  }

  public update(dtSeconds: number): void {
    requireDelta(dtSeconds);
    this.particlesValue = Object.freeze(
      this.particlesValue
        .map((particle) =>
          Object.freeze({
            ...particle,
            x: particle.x + particle.vx * dtSeconds,
            y: particle.y + particle.vy * dtSeconds,
            ageSeconds: particle.ageSeconds + dtSeconds,
          }),
        )
        .filter((particle) => particle.ageSeconds < particle.lifetimeSeconds),
    );
  }

  /** The plain presentation every game but Star Defender uses; draw the particles yourself when a
   * game needs a camera transform, culling, or a fade. */
  public render(renderer: GameRenderer): void {
    for (const particle of this.particlesValue) {
      renderer.fillCircle(particle.x, particle.y, particle.radius, particle.color);
    }
  }

  public clear(): void {
    this.particlesValue = Object.freeze([]);
  }
}
