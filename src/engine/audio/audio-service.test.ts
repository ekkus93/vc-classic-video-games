import { assert, type TestCase } from "../../test/harness.js";
import {
  SharedWebAudioService,
  type AudioBufferResolver,
  type AudioLifecycleErrorReporter,
  type AudioLifecycleFailure,
} from "./audio-service.js";

/**
 * Minimal fakes for the Web Audio surface `SharedWebAudioService` actually calls -- `createGain`,
 * `createBufferSource`, `destination`, `state`, `resume`, `suspend`. Cast to the real DOM types at
 * the point they cross into the class under test (`as unknown as AudioContext`, etc.), the same
 * escape hatch this project's structural-fake pattern uses elsewhere for browser APIs with no
 * practical way to implement the full interface (there is no jsdom here). Real `AudioContext`,
 * `GainNode`, and `AudioBufferSourceNode` are enormous interfaces; nothing here pretends to
 * implement them structurally, so `noUnusedLocals`/strict checks never see the mismatch.
 */

class FakeGainNode {
  public gain = { value: 1 };
  public connectedTo: FakeGainNode | "destination" | null = null;

  public connect(destination: FakeGainNode | { readonly isDestination: true }): void {
    this.connectedTo = "isDestination" in destination ? "destination" : destination;
  }
}

class FakeAudioBufferSourceNode {
  public buffer: unknown = null;
  public loop = false;
  public connectedTo: FakeGainNode | null = null;
  public started = false;
  public stopped = false;
  private endedListener: (() => void) | null = null;

  public connect(destination: FakeGainNode): void {
    this.connectedTo = destination;
  }

  public start(): void {
    this.started = true;
  }

  public stop(): void {
    this.stopped = true;
  }

  public addEventListener(type: string, listener: () => void): void {
    if (type === "ended") {
      this.endedListener = listener;
    }
  }

  public fireEnded(): void {
    this.endedListener?.();
  }
}

class FakeAudioContext {
  public state: "suspended" | "running" | "closed" = "suspended";
  public readonly destination = Object.freeze({ isDestination: true as const });
  public readonly createdGains: FakeGainNode[] = [];
  public readonly createdSources: FakeAudioBufferSourceNode[] = [];
  public resumeCalls = 0;
  public suspendCalls = 0;
  public resumeFailure: unknown = null;
  public suspendFailure: unknown = null;

  public createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.createdGains.push(gain);
    return gain;
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    const source = new FakeAudioBufferSourceNode();
    this.createdSources.push(source);
    return source;
  }

  public async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeFailure !== null) {
      throw this.resumeFailure;
    }
    this.state = "running";
  }

  public async suspend(): Promise<void> {
    this.suspendCalls += 1;
    if (this.suspendFailure !== null) {
      throw this.suspendFailure;
    }
    this.state = "suspended";
  }

  // Named accessors for the three gains created (in order) by unlock(): master, music, sfx.
  public get masterGain(): FakeGainNode | undefined {
    return this.createdGains[0];
  }
  public get musicGain(): FakeGainNode | undefined {
    return this.createdGains[1];
  }
  public get sfxGain(): FakeGainNode | undefined {
    return this.createdGains[2];
  }
}

class FakeAudioBufferResolver implements AudioBufferResolver {
  public readonly queries: string[] = [];
  private readonly buffers = new Map<string, unknown>();

  public set(assetId: string, buffer: unknown = {}): void {
    this.buffers.set(assetId, buffer);
  }

  public getAudioBuffer(assetId: string): AudioBuffer | null {
    this.queries.push(assetId);
    return (this.buffers.get(assetId) ?? null) as AudioBuffer | null;
  }
}

interface Harness {
  readonly service: SharedWebAudioService;
  readonly resolver: FakeAudioBufferResolver;
  readonly contexts: readonly FakeAudioContext[];
  readonly failures: readonly AudioLifecycleFailure[];
  readonly context: () => FakeAudioContext;
}

function harness(reportOverride?: AudioLifecycleErrorReporter): Harness {
  const contexts: FakeAudioContext[] = [];
  const resolver = new FakeAudioBufferResolver();
  const failures: AudioLifecycleFailure[] = [];
  const factory = () => {
    const context = new FakeAudioContext();
    contexts.push(context);
    return context as unknown as AudioContext;
  };
  const service = new SharedWebAudioService(
    resolver,
    factory,
    reportOverride ?? ((failure) => failures.push(failure)),
  );
  return {
    service,
    resolver,
    contexts,
    failures,
    context: () => {
      const current = contexts[contexts.length - 1];
      if (current === undefined) {
        throw new Error("fixture error: no context has been created yet");
      }
      return current;
    },
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const NEUTRAL_SETTINGS = Object.freeze({
  masterVolume: 1,
  musicVolume: 0.8,
  effectsVolume: 1,
  muted: false,
});

export const tests: readonly TestCase[] = [
  {
    name: "TC-002 configure rejects a non-finite volume for each channel",
    run: () => {
      const { service } = harness();
      for (const key of ["masterVolume", "musicVolume", "effectsVolume"] as const) {
        let rejected = false;
        try {
          service.configure({ ...NEUTRAL_SETTINGS, [key]: NaN });
        } catch (error) {
          rejected = error instanceof RangeError;
        }
        assert(rejected, `configure must reject a non-finite ${key}`);
      }
    },
  },
  {
    name: "TC-002 configure clamps out-of-range volumes into [0, 1]",
    run: () => {
      const { service, context } = harness();
      service.configure({
        masterVolume: -5,
        musicVolume: 5,
        effectsVolume: -0.001,
        muted: false,
      });
      // configure()'s clamping is only observable once a context exists to apply gain values to.
      void service.unlock();
      const ctx = context();
      assert(
        ctx.masterGain?.gain.value === 0,
        `masterVolume -5 must clamp to 0, got ${ctx.masterGain?.gain.value}`,
      );
      assert(
        ctx.musicGain?.gain.value === 1,
        `musicVolume 5 must clamp to 1, got ${ctx.musicGain?.gain.value}`,
      );
      assert(
        ctx.sfxGain?.gain.value === 0,
        `effectsVolume -0.001 must clamp to 0, got ${ctx.sfxGain?.gain.value}`,
      );
    },
  },
  {
    name: "TC-002 muted forces the master gain to zero without altering the music/effects channel values",
    run: () => {
      const { service, context } = harness();
      void service.unlock();
      service.configure({ masterVolume: 0.8, musicVolume: 0.6, effectsVolume: 0.9, muted: true });
      const ctx = context();
      assert(
        ctx.masterGain?.gain.value === 0,
        "muted must force the master gain to 0 regardless of masterVolume",
      );
      assert(
        ctx.musicGain?.gain.value === 0.6 && ctx.sfxGain?.gain.value === 0.9,
        "muted must not alter the music/effects channel gain values themselves",
      );
    },
  },
  {
    name: "TC-002 unlock creates the context once and wires music/sfx into master into destination",
    run: async () => {
      const h = harness();
      await h.service.unlock();
      assert(h.contexts.length === 1, "unlock must create the context exactly once");
      const ctx = h.context();
      assert(
        ctx.musicGain?.connectedTo === ctx.masterGain &&
          ctx.sfxGain?.connectedTo === ctx.masterGain,
        "music and sfx gains must both connect into the master gain",
      );
      assert(
        ctx.masterGain?.connectedTo === "destination",
        "the master gain must connect to the context's destination",
      );

      await h.service.unlock();
      assert(h.contexts.length === 1, "a second unlock() must not recreate the context");
    },
  },
  {
    name: "TC-002 isUnlocked reflects context.state, and unlock resumes an existing suspended context without recreating it",
    run: async () => {
      const h = harness();
      assert(!h.service.isUnlocked, "isUnlocked must be false before the first unlock()");

      await h.service.unlock();
      assert(h.service.isUnlocked, "isUnlocked must be true once the context is running");

      // Simulate the context becoming suspended again (as pauseAll() would cause).
      h.context().state = "suspended";
      assert(!h.service.isUnlocked, "isUnlocked must track a context that becomes suspended");

      const resumeCallsBefore = h.context().resumeCalls;
      await h.service.unlock();
      assert(h.contexts.length === 1, "resuming an existing context must not create a new one");
      assert(
        h.context().resumeCalls === resumeCallsBefore + 1,
        "unlock() on a suspended context must call resume()",
      );
      assert(h.service.isUnlocked, "isUnlocked must be true again once resumed");
    },
  },
  {
    name: "TC-002 playEffect/playLoop are a no-op before the service is unlocked",
    run: async () => {
      const { service, resolver, context } = harness();
      resolver.set("boom", {});
      service.playEffect("boom");
      service.playLoop("music-loop");
      assert(
        resolver.queries.length === 0,
        "the resolver must never be consulted before any context exists",
      );

      // Distinct from "no context yet": a context can exist but not be running (e.g. suspended
      // by pauseAll(), or never having finished resuming). isUnlocked, not just a null check on
      // the context, must gate playback.
      await service.unlock();
      context().state = "suspended";
      service.playEffect("boom");
      assert(
        resolver.queries.length === 0,
        "the resolver must not be consulted while the context exists but isn't running",
      );
    },
  },
  {
    name: "TC-002 playEffect/playLoop are a no-op once unlocked if the resolver has no buffer for the asset",
    run: async () => {
      const { service, context } = harness();
      await service.unlock();
      service.playEffect("missing-effect");
      assert(
        context().createdSources.length === 0,
        "a missing buffer must not create a source, even once unlocked",
      );
    },
  },
  {
    name: "TC-002 playEffect and playLoop route to the correct bus, with playLoop defaulting to music",
    run: async () => {
      const { service, resolver, context } = harness();
      await service.unlock();
      resolver.set("boom", {});
      resolver.set("theme", {});

      service.playEffect("boom");
      const effectSource = context().createdSources[0];
      assert(
        effectSource !== undefined &&
          effectSource.loop === false &&
          effectSource.started &&
          effectSource.connectedTo === context().sfxGain,
        "playEffect must create a non-looping source on the sfx bus and start it",
      );

      service.playLoop("theme");
      const loopSource = context().createdSources[1];
      assert(
        loopSource !== undefined &&
          loopSource.loop === true &&
          loopSource.connectedTo === context().musicGain,
        "playLoop with no explicit bus must default to the music bus and loop",
      );

      service.playLoop("theme", "sfx");
      const explicitSfxLoop = context().createdSources[2];
      assert(
        explicitSfxLoop !== undefined && explicitSfxLoop.connectedTo === context().sfxGain,
        "playLoop must honor an explicit sfx bus override",
      );
    },
  },
  {
    name: "TC-002 a source that fires its own ended event is removed from the active set",
    run: async () => {
      const { service, resolver, context } = harness();
      await service.unlock();
      resolver.set("boom", {});
      service.playEffect("boom");
      const source = context().createdSources[0];
      assert(source !== undefined, "fixture premise: the effect must have created a source");

      source.fireEnded();
      // If the ended listener actually removed it from the internal active set, a later stop()
      // call for the same asset id has nothing left to act on and never calls source.stop().
      service.stop("boom");
      assert(
        !source.stopped,
        "a source already removed via its own ended event must not be stopped again",
      );
    },
  },
  {
    name: "TC-002 stop only stops sources matching the given asset id",
    run: async () => {
      const { service, resolver, context } = harness();
      await service.unlock();
      resolver.set("boom", {});
      resolver.set("theme", {});
      service.playEffect("boom");
      service.playLoop("theme");
      const [boomSource, themeSource] = context().createdSources;
      assert(boomSource !== undefined && themeSource !== undefined, "fixture premise");

      service.stop("boom");
      assert(boomSource.stopped, "the matching asset id's source must be stopped");
      assert(!themeSource.stopped, "a differently-id'd active source must be left untouched");
    },
  },
  {
    name: "TC-002 stopAll stops every active source",
    run: async () => {
      const { service, resolver, context } = harness();
      await service.unlock();
      resolver.set("boom", {});
      resolver.set("theme", {});
      service.playEffect("boom");
      service.playLoop("theme");

      service.stopAll();
      assert(
        context().createdSources.every((source) => source.stopped),
        "stopAll must stop every currently-active source",
      );
    },
  },
  {
    name: "TC-002 pauseAll/resumeAll act only when the context is in the matching state",
    run: async () => {
      const { service, context } = harness();
      await service.unlock();
      assert(context().state === "running", "fixture premise: unlock must leave the context running");
      // unlock() itself already called resume() once internally -- track deltas from here rather
      // than absolute call counts.
      const resumeCallsAfterUnlock = context().resumeCalls;

      service.pauseAll();
      assert(context().state === "suspended" && context().suspendCalls === 1, "pauseAll must suspend a running context");

      service.pauseAll();
      assert(context().suspendCalls === 1, "pauseAll must not suspend an already-suspended context a second time");

      service.resumeAll();
      assert(
        context().state === "running" &&
          context().resumeCalls === resumeCallsAfterUnlock + 1,
        "resumeAll must resume a suspended context",
      );

      service.resumeAll();
      assert(
        context().resumeCalls === resumeCallsAfterUnlock + 1,
        "resumeAll must not resume an already-running context a second time",
      );
    },
  },
  {
    name: "CR5-006 pauseAll reports a rejected suspend exactly once",
    run: async () => {
      const h = harness();
      await h.service.unlock();
      const failure = new Error("suspend denied");
      h.context().suspendFailure = failure;

      h.service.pauseAll();
      await flushPromises();

      assert(h.failures.length === 1, "rejected suspend must be reported exactly once");
      assert(h.failures[0]?.operation === "suspend", "suspend failure must name its operation");
      assert(h.failures[0]?.error === failure, "suspend failure must retain the underlying error");
    },
  },
  {
    name: "CR5-006 resumeAll reports a rejected resume exactly once",
    run: async () => {
      const h = harness();
      await h.service.unlock();
      h.context().state = "suspended";
      const failure = new Error("resume denied");
      h.context().resumeFailure = failure;

      h.service.resumeAll();
      await flushPromises();

      assert(h.failures.length === 1, "rejected resume must be reported exactly once");
      assert(h.failures[0]?.operation === "resume", "resume failure must name its operation");
      assert(h.failures[0]?.error === failure, "resume failure must retain the underlying error");
    },
  },
  {
    name: "CR5-006 a throwing lifecycle reporter remains a terminally contained failure",
    run: async () => {
      const h = harness(() => {
        throw new Error("reporter broken");
      });
      await h.service.unlock();
      h.context().suspendFailure = new Error("suspend denied");

      h.service.pauseAll();
      await flushPromises();

      assert(
        h.context().suspendCalls === 1,
        "throwing reporter must not synchronously escape or cause a duplicate lifecycle call",
      );
    },
  },
];
