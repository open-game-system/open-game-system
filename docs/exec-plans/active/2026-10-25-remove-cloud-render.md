# Remove the cloud GPU rendering path (2026-10-25)

Owner decision (Jon, 2026-10-25, revised the same day): the host phone renders every TV. Nothing
renders in the cloud, on the Chromecast or in a TV browser ("they are not powerful enough").
AirPlay is unchanged (PR #53). Chromecast and "Another screen" (the browser TV, renamed in #57)
will receive the phone's off-screen render as a peer-to-peer WebRTC stream over the LAN, specced
on `spike/phone-p2p-cast`; some code deleted here (the receiver's WebRTC video client, stream-kit
pieces) may come back in P2P form. Cloud rendering may return later as a separate product. ADR:
[2026-10-25-local-rendering-only](../../adrs/2026-10-25-local-rendering-only.md).

Branch `chore/remove-cloud-render`, worktree `~/src/ogs-nocloud`, based on `origin/main` 3a579c4d.

## 1. Inventory (what existed on main at 3a579c4d)

| Area | What | Fate |
|---|---|---|
| Packages | `packages/stream-kit-{types,web,react,server,testing}` (~3,200 LOC) | Deleted |
| Example | `examples/stream-react-demo` (~750 LOC) | Deleted |
| Renderer | `services/api/container` (~6,900 LOC incl. lockfile): Cloud Run `stream-gpu` image (Bun server, Puppeteer Chrome, tab-capture extension, stream lifetime/idle, variants) | Deleted |
| API routes | `services/api/src/routes/stream.ts` (`/api/v1/stream`: start-stream, subscribe, subscribe/:id/answer, heartbeat, ice-servers, ready, health, debug-state, publisher/prepare, publisher/answer, publisher/state) | Deleted |
| API libs | `lib/realtime.ts` (Cloudflare Realtime SFU client), `protocol.ts` (SFU/TURN parsers) | Deleted |
| API env | `STREAM_SERVER_URL`, `CLOUDFLARE_REALTIME_APP_ID/SECRET`, `CLOUDFLARE_TURN_API_TOKEN/KEY_ID`, `DEBUG_STATE_TOKEN` (types.ts) | Deleted |
| API scripts | `scripts/stream-ready.mjs`, `stream-ready-check.mts`, `pnpm stream:ready` | Deleted |
| API tests | stream-routes, stream-sfu, stream-defaults, stream-ready, stream-ready-check, realtime, protocol; one wide-event case | Deleted (one wide-event case retargeted) |
| Receiver | `apps/web/public/receiver.html`: ICE fetch, start-stream, subscribe, answer, heartbeat (GPU keep-alive), connection timeout, URL overrides | Cloud client deleted; receiver kept (laptop PEER_OFFER, HUD, keep-awake, stops, logs). LOAD_VIEW shows a not-yet state |
| Launcher | `apps/tv` `session/activity.ts` (`window.__ogsActivityAt` for the renderer's idle stop), its tests, `e2e/idle.e2e.ts` | Deleted |
| Phone / shell | `streamServerUrl()`, `OGS_STREAM_SERVER_URL`, `EXPO_PUBLIC_OGS_STREAM`; LOAD_VIEW `streamServerUrl` | Replaced by LOAD_VIEW `apiUrl` (= `config.apiBase`, for the receiver's logs) |
| e2e | `e2e/tests/stream-pipe.e2e.ts`, `renderer-kit.ts`; receiver-kit's mock stream server + SFU | Deleted; receiver suites rewritten against no renderer |
| CI | `ci-api-deploy.yml` "Set secrets" (STREAM_SERVER_URL, TURN); `ci-api-preview.yml` preview secrets (Realtime, TURN, DEBUG_STATE_TOKEN); `publish-packages.yml` stream-kit; `.changeset` stream-kit group | Deleted |
| Scripts | `.ralph/ralph-realtime-sfu.sh` | Deleted |
| Docs | architecture, structure, quality, roadmap, lessons, e2e, observability, tv-casting spec, acceptance (`stream-full-pipe`, `cast-to-tv-streaming`, cast-to-TV test plan deleted; receiver + logging features updated), ADR index | Updated |
| Cost meters / idle shutdown | Receiver heartbeat (60 s) + 410, renderer idle stop (20 min `__ogsActivityAt`), 3 h lifetime, no-phone 20 min | Cloud parts deleted; receiver's no-phone 20 min and 3 h stops kept (they still end a cast left on) |
| Scheduled jobs | none: `wrangler.jsonc` `triggers.crons: []`; only GitHub cron is `sre-agent.yml` (logs, not GPU) | Nothing to remove |

Left on purpose:

- `cast-kit-core` `session.streamSessionId` (always null; part of a published package's bridge
  state): a separate breaking change.
- `apps/web` marketing copy (Index, Collective, Footer) still advertises "Cloud Rendering" and
  "stream-kit": public product copy for Jon to rewrite or approve.
- Historical briefings and exec plans that mention the stream (history).
- Wrangler migrations `v1`/`v3` for `StreamContainer` (append-only).

## 2. Cloud resources

### Shutdown done (2026-10-25)

Jon approved the shutdown; the coordinator ran it on 2026-10-25. Re-checked read-only afterwards:
`gcloud run services list` and `gcloud artifacts repositories list` in `opengame-stream` are
empty, `wrangler containers list` finds none, and the `opengame-api-pr-5` script answers 404.

- Deleted: Cloud Run `stream-gpu` in us-east4 and europe-west4; Artifact Registry `stream`
  (us-central1, 1.7 GB); Cloudflare container app `codeflare-containers-pr-5`; Worker
  `opengame-api-pr-5`.
- Kept on purpose: the GCP project `opengame-stream` (the Generative Language API is enabled
  there and it may hold the Gemini key in use); the production `opengame-api` stream secrets and
  the `STREAM_SERVER_URL` repo variable, until this PR is deployed (then delete them with the
  commands below).
- Not touched: org secrets used by the preview workflow, the Realtime SFU app and TURN key
  (usage-billed only), the old `stream-server*` / `container*` Workers (per-request billing).

### Read-only check before the shutdown (2026-10-25 ~14:30 PT)

Each item: state, cost, how to shut it down.

| Resource | State found | Billing | Shut down |
|---|---|---|---|
| Cloud Run `stream-gpu`, project `opengame-stream`, **us-east4** (L4, 8 vCPU, 32 GiB, maxScale 1, minScale 0, revision `stream-gpu-00025-488`, Ready) | Provisioned. 0 instances in the last 24 h (Monitoring `instance_count`: no series), no logs in 7 days | Nothing while scaled to zero; any request to its URL cold-starts a billed L4 | `gcloud run services delete stream-gpu --region=us-east4 --project=opengame-stream` |
| Cloud Run `stream-gpu`, project `opengame-stream`, **europe-west4** (L4, 4 vCPU, 16 GiB, maxScale 1, revision `stream-gpu-00001-48l`, Ready since 2026-09-28) | Provisioned, undocumented anywhere in the repo, idle | Same as above | `gcloud run services delete stream-gpu --region=europe-west4 --project=opengame-stream` |
| Artifact Registry Docker repo `stream` (project `opengame-stream`, us-central1) | 1,692 MB of images | Storage, roughly $0.10/GB-month beyond the free 0.5 GB (about $0.12/month; unverified against the bill) | `gcloud artifacts repositories delete stream --location=us-central1 --project=opengame-stream` |
| GCP project `opengame-stream` (billing enabled, account `011A80-173F79-8E95B5`) | Compute Engine and Cloud Scheduler APIs not enabled (no VMs, no scheduler jobs); no Cloud Run jobs; no Cloud Build triggers | Only the items above | After the above: `gcloud projects delete opengame-stream` (30-day recovery window) |
| Cloudflare container app `codeflare-containers-pr-5` (id `a0310c36-629f-4a48-8c7d-405175185ed4`; 0.5 vCPU, 4 GiB, 8 GB disk; `instances: 2`, health: 2 healthy, 0 active) | Provisioned for the old PR-5 preview Worker | 2 instances kept healthy; whether idle prewarmed instances bill is **unverified** (Cloudflare bills containers while running) | `npx wrangler containers delete a0310c36-629f-4a48-8c7d-405175185ed4`, then `npx wrangler delete --name opengame-api-pr-5` |
| Worker `opengame-api` secrets `STREAM_SERVER_URL`, `CLOUDFLARE_REALTIME_APP_ID/SECRET`, `CLOUDFLARE_TURN_API_TOKEN/KEY_ID` | Set (names listed; values never read) | None | `cd services/api && for s in STREAM_SERVER_URL CLOUDFLARE_REALTIME_APP_ID CLOUDFLARE_REALTIME_APP_SECRET CLOUDFLARE_TURN_API_TOKEN CLOUDFLARE_TURN_KEY_ID; do npx wrangler secret delete $s --name opengame-api; done` (after this PR deploys) |
| GitHub repo variable `STREAM_SERVER_URL` (= the us-east4 URL) | Set | None | `gh variable delete STREAM_SERVER_URL -R open-game-system/open-game-system` |
| Org secrets `CLOUDFLARE_REALTIME_APP_ID/SECRET`, `CLOUDFLARE_TURN_API_TOKEN/KEY_ID`, `DEBUG_STATE_TOKEN` (used by the preview workflow) | Not listed at repo level (org-level; not checked) | None | `gh secret delete <NAME> --org open-game-system` for each |
| Cloudflare Realtime SFU app and TURN key | **Unverified**: the API answered "Authentication error" to wrangler's OAuth token for `calls/apps` and `calls/turn_keys` | Usage-based only (no idle cost) | Dashboard: Realtime > SFU / TURN, delete the OGS app and key |
| Old Workers `stream-server` (2025-04), `stream-server-demo-pr-{1,12,14}`, `container-starter`, `containers-template`; `bun-stream-server` already gone | Deployed scripts; no container apps other than pr-5 | Workers bill per request (none expected) | `npx wrangler delete --name <worker>` for each |

## 3. Status

- [x] Inventory (this file)
- [x] Infra check, read-only (section 2)
- [x] Code, tests, CI removed (commit 12771eb4)
- [x] ADR 2026-10-25-local-rendering-only
- [x] Feedback commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`; receiver e2e (32 tests) green
- [x] Draft PR #55; merge only with Jon's yes, together with or after the P2P stream work (`spike/phone-p2p-cast`)
- [x] Cloud shutdown (section 2), approved by Jon, done 2026-10-25
- [ ] After deploy: delete the `opengame-api` stream secrets and the `STREAM_SERVER_URL` variable
