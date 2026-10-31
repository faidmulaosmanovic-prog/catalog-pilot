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

/** 120 requests per minute for one signed-in user. */
export function enforceUserApiLimit(userId: string, now = Date.now()) {
  return hitRateLimit(`api:${userId}`, 120, 60_000, now);
}

/** 10 CSV uploads per hour for one organization. Separate from the plan job cap. */
export function enforceImportUploadLimit(organizationId: string, now = Date.now()) {
  return hitRateLimit(`import-upload:${organizationId}`, 10, 60 * 60 * 1000, now);
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
