import {
  MemoryJsonDocumentStore,
  TauriJsonDocumentStore,
  type GameLogger,
  type JsonDocumentStore,
  type TauriInvoke,
} from "../../engine/index.js";
import { createGameRegistry } from "../../games/registry.js";
import {
  hasNativeBridge,
  invokeNative,
  setApplicationFullscreen,
} from "../../native/commands.js";
import type { AudioUnlock } from "./audio-unlock-gesture.js";
import { BrowserGameServices } from "./browser-game-services.js";
import { ShellController } from "./controller.js";
import { ShellGameInputBridge } from "./input-bridge.js";
import { LoopingGameHost } from "./looping-game-host.js";
import type { ShellRuntimeMode } from "./runtime-mode.js";


const CONSOLE_GAME_LOGGER: GameLogger = Object.freeze({
  debug: (message: string) => console.debug(`[game] ${message}`),
  info: (message: string) => console.info(`[game] ${message}`),
  warn: (message: string) => console.warn(`[game] ${message}`),
  error: (message: string, error?: unknown) => {
    if (error === undefined) {
      console.error(`[game] ${message}`);
    } else {
      console.error(`[game] ${message}`, error);
    }
  },
});

export interface DefaultShellRuntime {
  readonly mode: ShellRuntimeMode;
  readonly controller: ShellController;
  readonly gameHost: LoopingGameHost;
  readonly gameInput: ShellGameInputBridge;
  readonly unlockAudio: AudioUnlock;
}

export interface DefaultShellRuntimeOptions {
  readonly allowBrowserPreview: boolean;
  readonly nativeBridgeAvailable?: () => boolean;
  readonly invoke?: TauriInvoke;
}

export interface RuntimePersistenceSelection {
  readonly mode: ShellRuntimeMode;
  readonly documents: JsonDocumentStore;
}

export function selectRuntimePersistence(
  options: DefaultShellRuntimeOptions,
): RuntimePersistenceSelection {
  const native = (options.nativeBridgeAvailable ?? hasNativeBridge)();
  if (native) {
    return Object.freeze({
      mode: "native",
      documents: new TauriJsonDocumentStore(options.invoke ?? invokeNative),
    });
  }
  if (options.allowBrowserPreview) {
    return Object.freeze({
      mode: "browser-preview",
      documents: new MemoryJsonDocumentStore(),
    });
  }
  throw new Error(
    "Tauri native bridge is required; browser preview is disabled for this build",
  );
}

export function createDefaultShellRuntime(
  options: DefaultShellRuntimeOptions = { allowBrowserPreview: false },
): DefaultShellRuntime {
  const { mode, documents } = selectRuntimePersistence(options);
  const native = mode === "native";
  const gameInput = new ShellGameInputBridge();
  let controller: ShellController | null = null;
  const gameServices = new BrowserGameServices(
    documents,
    gameInput,
    CONSOLE_GAME_LOGGER,
    (notice) => {
      controller?.reportGamePersistenceWarning(notice.userMessage);
    },
  );
  const gameHost = new LoopingGameHost(
    (module, options) => gameServices.create(module, options),
    (message, error) => {
      controller?.recoverFromGameFailure(message, error);
    },
  );
  const common = {
    registry: createGameRegistry(),
    documents,
    gameHost,
    audio: gameServices.audio,
  };
  controller = native
    ? new ShellController({
        ...common,
        fullscreen: { setFullscreen: setApplicationFullscreen },
      })
    : new ShellController(common);
  const unlockAudio: AudioUnlock = () => gameServices.audio.unlock();

  return Object.freeze({ mode, controller, gameHost, gameInput, unlockAudio });
}

export function createDefaultShellController(
  options: DefaultShellRuntimeOptions = { allowBrowserPreview: false },
): ShellController {
  return createDefaultShellRuntime(options).controller;
}
