import {
  MemoryJsonDocumentStore,
  TauriJsonDocumentStore,
  type TauriInvoke,
} from "../../engine/index.js";
import { assert, type TestCase } from "../../test/harness.js";
import { selectRuntimePersistence } from "./default-controller.js";

const fakeInvoke: TauriInvoke = () => Promise.resolve(undefined) as Promise<never>;

export const tests: readonly TestCase[] = [
  {
    name: "CR5-005 native bridge selects durable Tauri persistence",
    run: () => {
      const selection = selectRuntimePersistence({
        allowBrowserPreview: false,
        nativeBridgeAvailable: () => true,
        invoke: fakeInvoke,
      });
      assert(selection.mode === "native", "present native bridge must select native runtime mode");
      assert(
        selection.documents instanceof TauriJsonDocumentStore,
        "native mode must use durable Tauri document persistence",
      );
    },
  },
  {
    name: "CR5-005 explicitly allowed development preview selects memory persistence",
    run: () => {
      const selection = selectRuntimePersistence({
        allowBrowserPreview: true,
        nativeBridgeAvailable: () => false,
        invoke: fakeInvoke,
      });
      assert(
        selection.mode === "browser-preview",
        "missing bridge may become preview only when preview was explicitly allowed",
      );
      assert(
        selection.documents instanceof MemoryJsonDocumentStore,
        "explicit preview may use volatile in-memory persistence",
      );
    },
  },
  {
    name: "CR5-005 native-required runtime fails closed when the bridge is missing",
    run: () => {
      let error: unknown = null;
      try {
        selectRuntimePersistence({
          allowBrowserPreview: false,
          nativeBridgeAvailable: () => false,
          invoke: fakeInvoke,
        });
      } catch (caught) {
        error = caught;
      }
      assert(error instanceof Error, "missing required native bridge must fail startup");
      assert(
        error instanceof Error && error.message.includes("browser preview is disabled"),
        "startup failure must explain that volatile preview fallback is forbidden",
      );
    },
  },
];
