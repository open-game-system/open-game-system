# Lessons Learned

Persistent record of gotchas, decisions, and hard-won knowledge for this project.

## Wrangler v3 to v4 upgrade

Wrangler v3 uses webpack internally, which conflicts with vitest's esbuild-based module resolution. Upgrading to wrangler v4 (`^4.0.0`) resolves compatibility issues and allows vitest to import the Hono app directly without bundler conflicts.

## D1 upsert pattern with ON CONFLICT

D1 (SQLite) supports upsert via `INSERT ... ON CONFLICT(column) DO UPDATE SET`. This is used in device registration to make re-registration idempotent -- if a device registers again with a new push token, the existing row is updated rather than failing with a unique constraint violation. Use `excluded.column_name` to reference the values from the attempted insert.

```sql
INSERT INTO devices (ogs_device_id, platform, push_token, created_at, updated_at)
VALUES (?, ?, ?, datetime('now'), datetime('now'))
ON CONFLICT(ogs_device_id) DO UPDATE SET
  platform = excluded.platform,
  push_token = excluded.push_token,
  updated_at = datetime('now')
```

## Error response structure consistency

All error responses must follow the same shape: `{ error: { code: string, message: string, status: number } }`. The `status` field inside the body mirrors the HTTP status code. Error codes use `snake_case` (e.g., `invalid_body`, `missing_fields`, `device_not_found`, `push_failed`). This consistency makes it easier for clients to handle errors programmatically.

## Push providers are stubs

`ApnsProvider` and `FcmProvider` in `src/providers/push.ts` are stub implementations that log and return success. They need real integration:

- **APNs**: Requires Apple developer credentials (team ID, key ID, .p8 signing key). Must generate JWT tokens and send HTTP/2 requests to `api.push.apple.com`. Cloudflare Workers support HTTP/2 fetch but the JWT signing needs to happen at the edge.
- **FCM**: Requires a Firebase service account or server key. Uses HTTP v1 API at `fcm.googleapis.com/v1/projects/{project}/messages:send`.

Until these are implemented, the `/send` endpoint will always report success even though no notification is actually delivered.

## Testing with D1 mocks

Tests mock the D1 database by creating an object that matches the `prepare() -> bind() -> run()/first()` chain. The mock in `notifications.test.ts` inspects the SQL string to route different queries (api_keys vs devices) to different mock return values. This approach avoids needing a real D1 binding in tests but means tests do not validate actual SQL correctness.

## Hono test requests with environment bindings

Hono's `app.request()` method accepts a third argument for environment bindings, which is how tests inject the mock D1 database. The first argument is the URL path, second is the `RequestInit`, third is the `Env` bindings object. This is specific to Hono's test helper and is not standard Fetch API.
