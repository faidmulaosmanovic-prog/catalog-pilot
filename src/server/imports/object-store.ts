import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Local stand-in for the R2 key layout `org/{orgId}/imports/{importId}/source.csv`.
 * Bytes stay under `.data`, which is gitignored. A queue worker can read the same keys later.
 */

const root = path.join(process.cwd(), ".data", "object-store");

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function importObjectKey(
  organizationId: string,
  importId: string,
  name: "source.csv" | "errors.csv",
) {
  return `org/${organizationId}/imports/${importId}/${name}`;
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function exportObjectKey(organizationId: string, exportId: string) {
  return `org/${organizationId}/exports/${exportId}/catalog.csv`;
}

export function putImportObject(key: string, bytes: Buffer) {
  const full = path.join(root, key);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);
}

export function readImportObject(key: string) {
  return readFileSync(path.join(root, key));
}
