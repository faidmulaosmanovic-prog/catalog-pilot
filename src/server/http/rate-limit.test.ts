import { describe, expect, it } from "vitest";

import { enforceImportUploadLimit, enforceUserApiLimit, hitRateLimit, resetRateLimits } from "./rate-limit";

describe("auth rate limit", () => {
  it("blocks the 11th attempt inside the window", () => {
    resetRateLimits();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(hitRateLimit("auth:test", 10, 60_000, 1_000).limited).toBe(false);
    }
    const blocked = hitRateLimit("auth:test", 10, 60_000, 1_000);
    expect(blocked.limited).toBe(true);
    if (blocked.limited) {
      expect(blocked.retryAfter).toBeGreaterThan(0);
    }
  });

  it("blocks the 121st API call and the 11th import upload", () => {
    resetRateLimits();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      expect(enforceUserApiLimit("user-1", 5_000).limited).toBe(false);
    }
    expect(enforceUserApiLimit("user-1", 5_000).limited).toBe(true);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(enforceImportUploadLimit("org-1", 5_000).limited).toBe(false);
    }
    expect(enforceImportUploadLimit("org-1", 5_000).limited).toBe(true);
  });
});
