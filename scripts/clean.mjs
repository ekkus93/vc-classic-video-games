import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

for (const target of process.argv.slice(2)) {
  const resolved = resolve(root, target);
  if (resolved === root) {
    throw new Error("Refusing to remove repository root");
  }
  await rm(resolved, { recursive: true, force: true });
}
