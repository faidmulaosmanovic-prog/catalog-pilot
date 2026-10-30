import { config } from "dotenv";

config({ path: ".env.local" });
config();

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
}
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
