import type {
  DiagnosticPingRequest,
  DiagnosticPingResponse,
  PlatformInfo,
} from "../native/commands.js";
import type { ShellRuntimeMode } from "./shell/runtime-mode.js";

export type NativeStatus =
  | { readonly state: "loading" }
  | {
      readonly state: "connected";
      readonly platform: PlatformInfo;
      readonly echo: string;
    }
  | { readonly state: "preview" }
  | { readonly state: "error"; readonly message: string };

export type PlatformInfoLoader = () => Promise<PlatformInfo>;
export type DiagnosticPinger = (
  request: DiagnosticPingRequest,
) => Promise<DiagnosticPingResponse>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function probeNativeStatus(
  mode: ShellRuntimeMode,
  loadPlatformInfo: PlatformInfoLoader,
  ping: DiagnosticPinger,
): Promise<NativeStatus> {
  if (mode === "browser-preview") {
    return Object.freeze({ state: "preview" });
  }

  try {
    const [platform, response] = await Promise.all([
      loadPlatformInfo(),
      ping({ message: "launcher-ready" }),
    ]);
    return Object.freeze({ state: "connected", platform, echo: response.echo });
  } catch (error) {
    return Object.freeze({
      state: "error",
      message: `Native bridge diagnostics failed: ${describeError(error)}`,
    });
  }
}
