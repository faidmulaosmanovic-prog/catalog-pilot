# Incident runbook

Short guide for a pilot outage. Do not paste catalog rows, passwords, or Stripe secrets into tickets.

## What to check first

1. Read the server log line. Unexpected errors are one JSON object with `level`, `message`, and `requestId`.
2. Give the customer the `requestId` from the API error body. The response does not include a stack trace.
3. If `SENTRY_DSN` is set, the same message is posted to Sentry. Create an alert there for a spike of error events.

## Common cases

| Symptom | What to do |
|---|---|
| HTTP 429 | Auth is 10 requests per minute per IP. Signed-in API calls are 120 per minute per user. CSV upload is 10 per hour per organization. Wait for `Retry-After`. |
| Stripe webhook 400 | The signature does not match `STRIPE_WEBHOOK_SECRET`, or the timestamp is older than 5 minutes. |
| Stripe webhook applied twice | The second delivery with the same event id is ignored. |
| Catalog writes return 402 | The trial ended or a plan limit was reached. The owner upgrades in Billing. |
| Export download 403 | The signed URL expired (15 minutes) or the caller is in another organization. |

## Restore

Follow [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). Restore into a new database and point `DATABASE_URL` at it only after the plan codes match the last drill.
