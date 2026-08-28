import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isInside(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

export function findCrossGameImport(root, sourcePath, specifier) {
  const gamesRoot = resolve(root, "src", "games");
  const absoluteSource = resolve(sourcePath);
  if (!isInside(gamesRoot, absoluteSource)) {
    return null;
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const sourceRelative = relative(gamesRoot, absoluteSource);
  const sourceGame = sourceRelative.split(sep)[0];
  const target = resolve(dirname(absoluteSource), specifier);
  if (!isInside(gamesRoot, target)) {
    return null;
  }

  const targetGame = relative(gamesRoot, target).split(sep)[0];
  if (
    sourceGame === undefined ||
    targetGame === undefined ||
    sourceGame === targetGame
  ) {
    return null;
  }

  return { sourceGame, targetGame, specifier };
}

export function extractModuleSpecifiers(source) {
  const specifiers = [];
  const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/gu;
  let match = pattern.exec(source);
  while (match !== null) {
    const specifier = match[1];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
    match = pattern.exec(source);
  }
  return specifiers;
}
