# Streaming renders only on Cloud Run; the Cloudflare container is removed

**Date:** 2026-10-06
**Status:** Accepted (owner-approved cleanup)
**Supersedes:** the rendering and API parts of [Cast-kit must use app-bridge for state sync](2026-03-14-cast-kit-uses-app-bridge.md)
(stream-kit on a Cloudflare Container per cast, `/cast/sessions*`). Its app-bridge decision stands.

## Context

A cast's TV page (the OGS TV launcher) is rendered in headless Chrome and published as WebRTC video
to the Cloudflare Realtime SFU, which the Chromecast receiver plays. The API had two renderers:

- **Cloud Run** (`stream-gpu`, project `opengame-stream`, us-east4: one L4 GPU, scale to zero),
  named by the `STREAM_SERVER_URL` secret: the production renderer.
- **A Cloudflare Container per cast** (`StreamContainer` Durable Object, container application
  `codeflare-containers`), used when `STREAM_SERVER_URL` was unset. No GPU, and the image registry is
  tied to one Worker name (docs/lessons.md). It also forced a Docker build on every `wrangler deploy`
  and `wrangler dev`.

The v1 cast-session API (`/api/v1/cast/*`, table `cast_sessions`) and the March `bun-stream-server`
Worker (`examples/stream-server-demo`, its own container) only fed that container path.

## Decision

- Cloud Run is the only renderer. The stream routes (`start-stream`, `heartbeat`, `health`,
  `debug-state`, `publisher/*`) talk to `STREAM_SERVER_URL`; without it they answer 500
  `stream_not_configured`. `GET /stream/ready` reports `renderer: { url }`.
- Removed: the `StreamContainer` class (migration `v3`, `deleted_classes`), its binding, the
  `containers` block (production and PR previews), `@cloudflare/containers`, v1 casting
  (`routes/cast.ts`, `cast_sessions` in schema.sql, the app's unused `cast-api.ts`) and
  `examples/stream-server-demo` with its preview workflows.
- `services/api/container/` stays: it is the source of the Cloud Run image.

## Consequences

- `wrangler deploy` and `wrangler dev` no longer build a Docker image; `--enable-containers=false`
  is gone.
- No fallback: an API without `STREAM_SERVER_URL` cannot cast (`pnpm stream:ready` says so). PR
  previews get no `STREAM_SERVER_URL` from CI, so a preview Worker no longer casts unless one is
  set on it by hand.
- Left for the owner to delete by hand: the `codeflare-containers` container application and the
  `bun-stream-server` Worker on Cloudflare, and the `cast_sessions` table in the production D1
  (schema.sql is applied on every deploy and never drops).
