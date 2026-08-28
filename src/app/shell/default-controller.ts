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
import { ShellController } from "./controller.js";
import { UnavailableGameHost } from "./game-host.js";

export function createDefaultShellController(): ShellController {
  const native = hasNativeBridge();
  const documents = native
    ? new TauriJsonDocumentStore(invokeNative)
    : new MemoryJsonDocumentStore();
  const common = {
    registry: createGameRegistry(),
    documents,
    gameHost: new UnavailableGameHost(),
  };

  return native
    ? new ShellController({
        ...common,
        fullscreen: { setFullscreen: setApplicationFullscreen },
      })
    : new ShellController(common);
}
