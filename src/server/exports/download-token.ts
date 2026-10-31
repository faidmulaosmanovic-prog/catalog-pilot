import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required to sign export downloads");
  }
  return value;
}

export function signExportDownload(jobId: string, now = Date.now()) {
  const expires = String(now + TTL_MS);
  const token = createHmac("sha256", secret()).update(`${jobId}.${expires}`).digest("base64url");
  return { expires, token, url: `/api/v1/exports/${jobId}/download?expires=${expires}&token=${token}` };
}

export function verifyExportDownload(jobId: string, expires: string | null, token: string | null) {
  if (!expires || !token) return false;
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(`${jobId}.${expires}`).digest("base64url");
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
