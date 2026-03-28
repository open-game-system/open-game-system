# Lessons
Patterns and mistakes from the Realtime SFU migration. Review at start of each iteration.
---

- Container server.ts and extension streaming.js exist in TWO places: `examples/stream-server-demo/container/` (canonical) and `services/api/container/` (copy). Always update canonical first, then copy.
- Container's `protocol.ts` is a COPY — must be kept in sync with the canonical one. See protocol.ts in both `examples/stream-server-demo/container/src/` and `services/api/container/src/`.
- The Env interface in `services/api/src/types.ts` drives wrangler bindings — any new secret must be added there AND in wrangler.jsonc.
- CF Realtime SFU API base URL: `https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/...`
- Auth: `Authorization: Bearer {APP_SECRET}` (not API token, the app secret)
- Stream routes must rewrite URLs before proxying to container — container expects bare paths like `/health`, `/publisher/prepare`, NOT `/api/v1/stream/health`.
- The vitest config for services/api must exclude `container/**` to avoid picking up zod tests in node_modules.
- Never modify existing tests to make new code pass. If new code breaks tests, the new code is wrong.
- Extension INITIALIZE function uses destructured params — add new params to the destructuring signature, not as `params.foo`.
