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

function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const core = window.__TAURI__?.core;
  if (core === undefined) {
    return Promise.reject(new Error("Tauri native bridge is unavailable"));
  }
  return core.invoke<T>(command, args);
}

export async function diagnosticPing(
  request: DiagnosticPingRequest,
): Promise<DiagnosticPingResponse> {
  const [echo, appName] = await invoke<[string, string]>("diagnostic_ping", {
    message: request.message,
  });
  return { echo, appName };
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  const [os, arch, appVersion] = await invoke<[string, string, string]>(
    "platform_info",
  );
  return { os, arch, appVersion };
}
