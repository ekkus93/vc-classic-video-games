interface TauriCoreApi {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI__?: {
      readonly core: TauriCoreApi;
    };
  }
}

export interface DiagnosticPingRequest {
  readonly message: string;
}

export interface DiagnosticPingResponse {
  readonly echo: string;
  readonly appName: string;
}

export interface PlatformInfo {
  readonly os: string;
  readonly arch: string;
  readonly appVersion: string;
}

export function hasNativeBridge(): boolean {
  return typeof window !== "undefined" && window.__TAURI__?.core !== undefined;
}

export function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tauri native bridge is unavailable"));
  }
  const core = window.__TAURI__?.core;
  if (core === undefined) {
    return Promise.reject(new Error("Tauri native bridge is unavailable"));
  }
  return core.invoke<T>(command, args);
}

export async function diagnosticPing(
  request: DiagnosticPingRequest,
): Promise<DiagnosticPingResponse> {
  const [echo, appName] = await invokeNative<[string, string]>("diagnostic_ping", {
    message: request.message,
  });
  return { echo, appName };
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  const [os, arch, appVersion] = await invokeNative<[string, string, string]>(
    "platform_info",
  );
  return { os, arch, appVersion };
}

export function setApplicationFullscreen(fullscreen: boolean): Promise<void> {
  return invokeNative<void>("set_fullscreen", { fullscreen });
}
