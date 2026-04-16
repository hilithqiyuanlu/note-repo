import fs from "node:fs";
import path from "node:path";

const root = /* turbopackIgnore: true */ process.cwd();
const storageRoot = path.join(root, "storage");
const uploadsRoot = path.join(storageRoot, "uploads");
const exportsRoot = path.join(storageRoot, "exports");
const dataRoot = path.join(storageRoot, "data");

export function ensureStorageDirs() {
  [storageRoot, uploadsRoot, exportsRoot, dataRoot].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function getDbPath() {
  ensureStorageDirs();
  return path.join(storageRoot, "app.db");
}

export function getUploadsRoot() {
  ensureStorageDirs();
  return uploadsRoot;
}

export function getExportsRoot() {
  ensureStorageDirs();
  return exportsRoot;
}

export function getDataRoot() {
  ensureStorageDirs();
  return dataRoot;
}

export function absoluteWithinStorage(...segments: string[]) {
  ensureStorageDirs();
  return path.join(storageRoot, ...segments);
}
