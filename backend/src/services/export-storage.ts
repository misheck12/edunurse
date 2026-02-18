import { mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../config.js";

function normalizeStorageKey(storageKey: string) {
  const normalized = path.posix.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

export function getExportStorageRoot() {
  return path.resolve(process.cwd(), env.EXPORT_STORAGE_DIR);
}

export async function ensureExportStorageDir() {
  await mkdir(getExportStorageRoot(), { recursive: true });
}

export function buildExportStorageKey(
  exportJobId: string,
  format: "pdf" | "docx" | "pptx",
) {
  return `${exportJobId}.${format}`;
}

export function resolveExportFilePath(storageKey: string) {
  const safeKey = normalizeStorageKey(storageKey);
  return path.join(getExportStorageRoot(), safeKey);
}
