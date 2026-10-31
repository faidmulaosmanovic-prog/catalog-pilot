import { afterEach, describe, expect, it, vi } from "vitest";

import { reportException, sentryTarget } from "./report-error";

describe("error reporting", () => {
  const previous = process.env.SENTRY_DSN;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = previous;
    }
    vi.unstubAllGlobals();
  });

  it("parses a DSN into the store URL", () => {
    expect(sentryTarget("https://public-key@o0.ingest.sentry.io/42")).toEqual({
      key: "public-key",
      url: "https://o0.ingest.sentry.io/api/42/store/",
    });
    expect(sentryTarget(undefined)).toBeNull();
  });

  it("posts the message when a DSN is set", async () => {
    process.env.SENTRY_DSN = "https://public-key@o0.ingest.sentry.io/42";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    reportException(new Error("boom"), { requestId: "req_test" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://o0.ingest.sentry.io/api/42/store/",
      expect.objectContaining({
        body: expect.stringContaining("boom"),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://o0.ingest.sentry.io/api/42/store/",
      expect.objectContaining({
        body: expect.stringContaining("req_test"),
      }),
    );
  });
});
