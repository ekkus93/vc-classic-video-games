import {
  MemoryJsonDocumentStore,
  TauriJsonDocumentStore,
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

export interface DefaultShellRuntime {
  readonly controller: ShellController;
  readonly gameHost: LoopingGameHost;
  readonly gameInput: ShellGameInputBridge;
  readonly unlockAudio: AudioUnlock;
}

export function createDefaultShellRuntime(): DefaultShellRuntime {
  const native = hasNativeBridge();
  const documents = native
    ? new TauriJsonDocumentStore(invokeNative)
    : new MemoryJsonDocumentStore();
  const gameInput = new ShellGameInputBridge();
  const gameServices = new BrowserGameServices(documents, gameInput);
  let controller: ShellController | null = null;
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

  return Object.freeze({ controller, gameHost, gameInput, unlockAudio });
}

export function createDefaultShellController(): ShellController {
  return createDefaultShellRuntime().controller;
}
