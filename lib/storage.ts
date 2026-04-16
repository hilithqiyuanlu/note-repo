import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = /* turbopackIgnore: true */ process.cwd();
const legacyStorageRoot = path.join(root, "storage");
const storageRoot =
  process.env.NOTEREPO_DATA_DIR || path.join(os.homedir(), ".noterepo");
const uploadsRoot = path.join(storageRoot, "uploads");
const exportsRoot = path.join(storageRoot, "exports");
const dataRoot = path.join(storageRoot, "data");

function migrateLegacyStorage() {
  if (storageRoot === legacyStorageRoot) {
    return;
  }

  const legacyDbPath = path.join(legacyStorageRoot, "app.db");
  const currentDbPath = path.join(storageRoot, "app.db");

  if (!fs.existsSync(currentDbPath) && fs.existsSync(legacyDbPath)) {
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.cpSync(legacyStorageRoot, storageRoot, { recursive: true });
  }
}

export function ensureStorageDirs() {
  migrateLegacyStorage();
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
