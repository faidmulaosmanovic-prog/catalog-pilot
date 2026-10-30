import { describe, expect, it } from "vitest";

import { hitRateLimit, resetRateLimits } from "./rate-limit";

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
});
