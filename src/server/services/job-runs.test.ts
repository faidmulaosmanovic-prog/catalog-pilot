import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { Database } from "@/server/db/client";

import { createJobRun, updateJobRunStatus } from "./job-runs";

const db = {} as Database;
const organizationId = "11111111-1111-4111-8111-111111111111";

describe("job run validation", () => {
  it("rejects a status outside the queue lifecycle", async () => {
    await expect(
      createJobRun(db, {
        organizationId,
        type: "import",
        status: "cancelled" as "queued",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects a status update for another shape of id", async () => {
    await expect(
      updateJobRunStatus(db, {
        id: "job-1",
        organizationId,
        status: "processing",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
