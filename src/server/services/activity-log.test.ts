import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { Database } from "@/server/db/client";

import { recordActivity } from "./activity-log";

const db = {} as Database;

describe("recordActivity validation", () => {
  it("rejects a non-uuid organization id before writing", async () => {
    await expect(
      recordActivity(db, {
        organizationId: "not-a-uuid",
        entityType: "product",
        action: "created",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects an empty action", async () => {
    await expect(
      recordActivity(db, {
        organizationId: "11111111-1111-4111-8111-111111111111",
        entityType: "product",
        action: "  ",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
