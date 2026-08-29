import { ActiveGameRuntime } from "../../engine/index.js";
import type { TextStyle } from "../../engine/render/renderer.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import SPACE_ROCKS_ASSETS from "./assets.json" with { type: "json" };
import { SPACE_ROCKS_AUDIO_IDS } from "./effects.js";
import { SPACE_ROCKS_MODULE, SpaceRocksGameInstance } from "./module.js";

class ThrowingRenderer extends FakeGameRenderer {
  public override clear(): void {
    throw new Error("injected renderer failure");
  }
}

class RecordingRenderer extends FakeGameRenderer {
  public drawnTexts: string[] = [];

  // FakeGameRenderer's own drawText() is declared with no parameters at all (a no-op stub), so
  // an override narrowing them to required must instead keep them optional to stay assignable to
  // the base method's `() => void` type -- callers reaching this through the GameRenderer
  // interface still pass all four arguments at the actual call site.
  public override drawText(text?: string, _x?: number, _y?: number, _style?: TextStyle): void {
    if (text !== undefined) {
      this.drawnTexts.push(text);
    }
  }
}

export const tests: readonly TestCase[] = [
  {
    name: "TC-006 real module consumes shared input and renders headlessly",
    run: () => {
      const services = createFakeGameServices(0x5c05);
      const instance = SPACE_ROCKS_MODULE.create(services);
      instance.start({ players: 1, difficulty: "drift", seed: 0x5c05 });

      services.input.setHeld(1, "up", true);
      instance.update(1 / 60);
      assert(
        services.audio.isActive(SPACE_ROCKS_AUDIO_IDS.thrust),
        "held thrust must drive the shared audio service through the real module",
      );

      services.input.setHeld(1, "action-1", true);
      instance.update(1 / 60);
      assert(
        services.audio.playedEffects.includes(SPACE_ROCKS_AUDIO_IDS.pulse),
        "shared action-1 press must fire a pulse through the real module",
      );

      instance.render(new FakeGameRenderer());
      instance.destroy();
      // Not activeCount === 0: SpaceRocksEffects.destroy() stops only the thrust loop it
      // explicitly tracks, not every audio id that was ever played (unlike, e.g., Deep Digger's
      // destroy(), which stops every DEEP_DIGGER_AUDIO_IDS entry). The fake's one-shot
      // playEffect() calls have no natural decay the way a real AudioBufferSourceNode's "ended"
      // event provides, so activeCount would stay nonzero here even though nothing is actually
      // leaking in production. The loop is the one real "still making noise" concern.
      assert(
        !services.audio.isActive(SPACE_ROCKS_AUDIO_IDS.thrust),
        "destroy must stop the thrust loop rather than leaving it looping",
      );
    },
  },
  {
    name: "TC-006 module validates launch options",
    run: () => {
      const instance = new SpaceRocksGameInstance(createFakeGameServices());
      let playersRejected = false;
      try {
        instance.start({ players: 2, difficulty: "drift", seed: 1 });
      } catch (error) {
        playersRejected = error instanceof Error;
      }
      assert(playersRejected, "unsupported player count must fail closed");

      let difficultyError: Error | null = null;
      try {
        instance.start({ players: 1, difficulty: "not-a-real-difficulty", seed: 1 });
      } catch (error) {
        difficultyError = error instanceof Error ? error : null;
      }
      // Checks the specific validation message, not just "some Error was thrown" -- the
      // simulation constructor also indexes SPACE_ROCKS_DIFFICULTIES[difficulty] unguarded, so an
      // invalid difficulty that slipped past resolveDifficulty's own check would still throw a
      // TypeError from that unrelated property access, which a looser instanceof-only check
      // could not tell apart from resolveDifficulty actually doing its job.
      assert(
        difficultyError?.message.includes("Unsupported Space Rocks difficulty") === true,
        `unsupported difficulty must be rejected by resolveDifficulty's own check, got: ${String(difficultyError)}`,
      );
    },
  },
  {
    name: "TC-006 module resolves only owned assets",
    run: () => {
      const resolveAssetUrl = SPACE_ROCKS_MODULE.resolveAssetUrl;
      assert(resolveAssetUrl !== undefined, "Space Rocks must expose bundled asset URLs");
      for (const entry of SPACE_ROCKS_ASSETS.assets) {
        assert(
          resolveAssetUrl(entry.path) !== null,
          `every manifest asset (${entry.path}) must resolve to a non-null URL`,
        );
      }
      assert(
        resolveAssetUrl("audio/does-not-exist.wav") === null,
        "an unknown asset path must resolve to null rather than throwing or guessing",
      );
    },
  },
  {
    name: "TC-006 pre-launch render draws the title screen",
    run: () => {
      const instance = new SpaceRocksGameInstance(createFakeGameServices());
      const renderer = new RecordingRenderer();
      instance.render(renderer);
      assert(
        renderer.drawnTexts.includes("SPACE ROCKS"),
        "rendering before start() must draw the title screen, not throw or draw gameplay state",
      );
    },
  },
  {
    name: "TC-006 pause resume restart and destroy remain safe across repeated lifecycle cycles",
    run: () => {
      const services = createFakeGameServices(0x5c06);
      const instance = new SpaceRocksGameInstance(services);
      for (let cycle = 0; cycle < 40; cycle += 1) {
        instance.start({ players: 1, difficulty: "orbit", seed: 100 + cycle });
        instance.update(1 / 60);
        instance.pause();
        instance.update(5);
        instance.resume();
        instance.reset();
        instance.render(new FakeGameRenderer());
        instance.destroy();
        instance.destroy();
        assert(services.audio.activeCount === 0, "lifecycle cycle must not leak audio ownership");
      }
    },
  },
  {
    name: "TC-006 real Space Rocks update failure is isolated by production runtime",
    run: async () => {
      const services = createFakeGameServices(0x5c07);
      const errors: string[] = [];
      const runtime = new ActiveGameRuntime(services, (e) => errors.push(e.phase));
      await runtime.load(SPACE_ROCKS_MODULE);
      await runtime.start({ players: 1, difficulty: "drift", seed: 0x5c07 });
      runtime.update(-1);
      assert(
        runtime.state === "error" && runtime.activeGameId === null,
        "update failure must isolate the game",
      );
      assert(
        errors.includes("update") && services.audio.stopAllCount >= 1,
        "update failure must report and clean audio",
      );
    },
  },
  {
    name: "TC-006 real Space Rocks render failure is isolated by production runtime",
    run: async () => {
      const services = createFakeGameServices(0x5c08);
      const errors: string[] = [];
      const runtime = new ActiveGameRuntime(services, (e) => errors.push(e.phase));
      await runtime.load(SPACE_ROCKS_MODULE);
      await runtime.start({ players: 1, difficulty: "drift", seed: 0x5c08 });
      runtime.render(new ThrowingRenderer());
      assert(
        runtime.state === "error" && runtime.activeGameId === null,
        "render failure must isolate the game",
      );
      assert(
        errors.includes("render") && services.audio.stopAllCount >= 1,
        "render failure must report and clean audio",
      );
    },
  },
];
