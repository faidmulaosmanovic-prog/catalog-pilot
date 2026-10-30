import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ORG_COOKIE = "catalog_organization_id";

export const GENERIC_REGISTER_MESSAGE =
  "If an account exists, check your email.";

export function appBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

const authEmails: Array<{
  to: string;
  kind: "verify" | "reset" | "invite";
  url: string;
  subject: string;
  sentAt: string;
}> = [];

export type AuthEmail = (typeof authEmails)[number];

const mailboxFile = path.join(process.cwd(), ".data", "auth-emails.jsonl");

function remember(email: AuthEmail) {
  authEmails.push(email);
  if (authEmails.length > 50) {
    authEmails.shift();
  }
  mkdirSync(path.dirname(mailboxFile), { recursive: true });
  appendFileSync(mailboxFile, `${JSON.stringify(email)}\n`);
}

export async function sendAuthEmail(input: Omit<AuthEmail, "sentAt">) {
  const email = { ...input, sentAt: new Date().toISOString() };
  remember(email);
  console.info(`[auth-email] ${email.kind} to ${email.to}: ${email.url}`);
}

export function listAuthEmails() {
  try {
    return readFileSync(mailboxFile, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AuthEmail);
  } catch {
    return [...authEmails];
  }
}

export function clearAuthEmails() {
  authEmails.length = 0;
  mkdirSync(path.dirname(mailboxFile), { recursive: true });
  writeFileSync(mailboxFile, "");
}
