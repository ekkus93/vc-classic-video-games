import { assert, type TestCase } from "../../test/harness.js";
import type { GameRenderer } from "../render/renderer.js";
import { ParticleBurstField } from "./particle-burst.js";

const BURST = Object.freeze({
  x: 40,
  y: 60,
  count: 8,
  speed: 30,
  lifetimeSeconds: 0.4,
  radius: 1.25,
  color: "#ffcf5a",
});

class CapturingRenderer {
  public readonly circles: string[] = [];
  public readonly logicalWidth = 320;
  public readonly logicalHeight = 240;
  public clear(): void {}
  public fillRect(): void {}
  public strokeRect(): void {}
  public fillCircle(x: number, y: number, radius: number, color: string): void {
    this.circles.push(`${x},${y},${radius},${color}`);
  }
  public strokeCircle(): void {}
  public drawLine(): void {}
  public drawPolyline(): void {}
  public drawText(): void {}
  public drawSprite(): void {}
}

function renderTo(field: ParticleBurstField): readonly string[] {
  const renderer = new CapturingRenderer();
  field.render(renderer as unknown as GameRenderer);
  return renderer.circles;
}

/**
 * Every particle in a burst starts at the burst's own origin, so a field rendered the instant it
 * bursts draws the same stack of circles whatever its velocities are. One short step lets the
 * velocities separate them, which is what makes two bursts comparable at all.
 */
function driftedRing(field: ParticleBurstField): string {
  field.update(0.01);
  return renderTo(field).join("|");
}

export const tests: readonly TestCase[] = [
  {
    name: "CR-017 particle burst field caps the live population no matter how many bursts arrive",
    run: () => {
      const field = new ParticleBurstField({ maxParticles: 10 });
      for (let index = 0; index < 50; index += 1) {
        field.burst(BURST);
      }
      assert(field.count === 10, "repeated bursts must clamp to the cap, not grow without bound");

      field.update(1);
      const drained: number = field.count;
      assert(drained === 0, "particles must retire once past their lifetime");

      field.burst({ ...BURST, count: 3 });
      const refilled: number = field.count;
      assert(refilled === 3, "a drained field must accept new bursts again");
    },
  },
  {
    name: "CR-017 a burst trimmed by the cap spawns exactly the room left",
    run: () => {
      const field = new ParticleBurstField({ maxParticles: 10 });
      field.burst({ ...BURST, count: 7 });
      field.burst({ ...BURST, count: 7 });
      assert(field.count === 10, "the second burst must be trimmed to the three remaining slots");
    },
  },
  {
    name: "CR-017 bursts are deterministic and consume no randomness",
    run: () => {
      const first = new ParticleBurstField({ maxParticles: 40 });
      const second = new ParticleBurstField({ maxParticles: 40 });
      for (let index = 0; index < 4; index += 1) {
        first.burst(BURST);
        second.burst(BURST);
      }
      assert(
        driftedRing(first) === driftedRing(second),
        "two fields driven identically must draw identical particles, so a replayed run looks the same",
      );
    },
  },
  {
    name: "CR-017 successive bursts differ from each other rather than stamping the same ring",
    run: () => {
      const field = new ParticleBurstField({ maxParticles: 40 });
      field.burst({ ...BURST, count: 6 });
      const firstRing = driftedRing(field);
      field.update(1);
      field.burst({ ...BURST, count: 6 });
      const secondRing = driftedRing(field);
      assert(
        firstRing !== secondRing,
        "the ring phase must advance per burst so repeated bursts do not overlay exactly",
      );
    },
  },
  {
    name: "CR-017 a dropped burst advances the phase only when the field opts in",
    run: () => {
      const holding = new ParticleBurstField({ maxParticles: 4 });
      const advancing = new ParticleBurstField({
        maxParticles: 4,
        advanceSerialOnDroppedBurst: true,
      });
      for (const field of [holding, advancing]) {
        field.burst({ ...BURST, count: 4 });
        field.burst({ ...BURST, count: 4 });
        field.update(1);
        field.burst({ ...BURST, count: 4 });
      }
      assert(
        driftedRing(holding) !== driftedRing(advancing),
        "opting in must let a burst the cap swallowed still shift the next one",
      );
    },
  },
  {
    name: "CR-017 particle burst field validates its own configuration and frame deltas",
    run: () => {
      let thrown: unknown = null;
      try {
        new ParticleBurstField({ maxParticles: -1 });
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof RangeError, "a negative cap must be rejected");

      thrown = null;
      try {
        new ParticleBurstField({ maxParticles: 8, speedScaleSteps: 0 });
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof RangeError, "a zero jitter modulus must be rejected");

      thrown = null;
      try {
        new ParticleBurstField({ maxParticles: 8 }).update(-1);
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof RangeError, "a negative frame delta must be rejected");
    },
  },
];
