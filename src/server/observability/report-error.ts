/**
 * Sends unexpected server errors to Sentry when SENTRY_DSN is set.
 * Without a DSN, the same event is written as one JSON log line.
 */

type ReportContext = {
  requestId?: string;
};

export function reportException(error: unknown, context: ReportContext = {}) {
  const message = (error instanceof Error ? error.message : "Unknown error").slice(0, 500);
  const event = {
    level: "error",
    message,
    requestId: context.requestId ?? null,
  };
  console.error(JSON.stringify(event));
  const target = sentryTarget(process.env.SENTRY_DSN);
  if (!target) {
    return;
  }
  void fetch(target.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_client=catalogpilot/0.1, sentry_key=${target.key}`,
    },
    body: JSON.stringify({
      event_id: crypto.randomUUID().replaceAll("-", ""),
      message,
      level: "error",
      platform: "node",
      timestamp: new Date().toISOString(),
      extra: { requestId: context.requestId ?? null },
    }),
  }).catch(() => {
    console.error(JSON.stringify({ level: "error", message: "Sentry report failed", requestId: context.requestId ?? null }));
  });
}

export function sentryTarget(dsn: string | undefined) {
  if (!dsn) {
    return null;
  }
  try {
    const url = new URL(dsn);
    const key = decodeURIComponent(url.username);
    const projectId = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    if (!key || !projectId) {
      return null;
    }
    return { key, url: `${url.protocol}//${url.host}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}
