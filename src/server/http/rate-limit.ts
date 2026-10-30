const buckets = new Map<string, number[]>();

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return {
      limited: true as const,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { limited: false as const, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "local";
  }
  return request.headers.get("x-real-ip") ?? "local";
}
