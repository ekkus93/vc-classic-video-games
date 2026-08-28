import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isInside(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function gameDirectory(relativePath) {
  const parts = relativePath.split(sep);
  // Files directly under src/games are composition/public-boundary code, not
  // game implementations. Isolation applies only within src/games/<game>/...
  return parts.length >= 2 ? parts[0] : null;
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

  const sourceGame = gameDirectory(relative(gamesRoot, absoluteSource));
  if (sourceGame === null) {
    return null;
  }

  const target = resolve(dirname(absoluteSource), specifier);
  if (!isInside(gamesRoot, target)) {
    return null;
  }

  const targetGame = gameDirectory(relative(gamesRoot, target));
  if (targetGame === null || sourceGame === targetGame) {
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
