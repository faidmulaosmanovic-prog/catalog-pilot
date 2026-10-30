import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createDb, getPostgresClient } from "@/server/db/client";
import { accounts, sessions, verifications } from "@/server/db/schema/auth-tables";
import { users } from "@/server/db/schema/identity";

import { appBaseUrl, sendAuthEmail } from "./email";

function requireSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters");
  }
  return secret;
}

const baseURL = appBaseUrl();

export const auth = betterAuth({
  secret: requireSecret(),
  baseURL,
  trustedOrigins: [baseURL],
  database: drizzleAdapter(createDb(getPostgresClient()), {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      passwordHash: {
        type: "string",
        required: false,
        input: false,
        returned: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const url = new URL("/reset-password", baseURL);
      url.searchParams.set("token", token);
      await sendAuthEmail({
        to: user.email,
        kind: "reset",
        url: url.toString(),
        subject: "Reset your CatalogPilot password",
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, token }) => {
      const url = new URL("/verify-email", baseURL);
      url.searchParams.set("token", token);
      await sendAuthEmail({
        to: user.email,
        kind: "verify",
        url: url.toString(),
        subject: "Verify your CatalogPilot email",
      });
    },
  },
});
