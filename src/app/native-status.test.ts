import { assert, type TestCase } from "../test/harness.js";
import { probeNativeStatus } from "./native-status.js";

const PLATFORM = Object.freeze({ os: "linux", arch: "x86_64", appVersion: "1.0.0" });

export const tests: readonly TestCase[] = [
  {
    name: "CR5-005 explicit browser preview skips native diagnostics",
    run: async () => {
      let calls = 0;
      const status = await probeNativeStatus(
        "browser-preview",
        () => {
          calls += 1;
          return Promise.resolve(PLATFORM);
        },
        () => {
          calls += 1;
          return Promise.resolve({ echo: "ok", appName: "fixture" });
        },
      );
      assert(status.state === "preview", "explicit preview must remain visibly preview mode");
      assert(calls === 0, "preview mode must not probe a native bridge that is intentionally absent");
    },
  },
  {
    name: "CR5-005 native diagnostic failure is an error, never browser preview",
    run: async () => {
      const status = await probeNativeStatus(
        "native",
        () => Promise.reject(new Error("bridge disconnected")),
        () => Promise.resolve({ echo: "ok", appName: "fixture" }),
      );
      assert(status.state === "error", "failed native diagnostics must produce an error state");
      assert(
        status.state === "error" && status.message.includes("bridge disconnected"),
        "native diagnostic error must retain diagnostic detail",
      );
    },
  },
  {
    name: "CR5-005 healthy native diagnostics report connected platform state",
    run: async () => {
      const status = await probeNativeStatus(
        "native",
        () => Promise.resolve(PLATFORM),
        () => Promise.resolve({ echo: "launcher-ready", appName: "fixture" }),
      );
      assert(status.state === "connected", "healthy native diagnostics must report connected");
      assert(
        status.state === "connected" && status.echo === "launcher-ready",
        "connected status must retain diagnostic ping response",
      );
    },
  },
];
