# Lessons Learned

Persistent project knowledge. Review at the start of each task.

## Platform & Framework

- **Wrangler v3 → v4**: Upgrade resolved esbuild/webpack conflicts with vitest. Always use wrangler v4+.
- **D1 upsert pattern**: Use `INSERT ... ON CONFLICT(pk) DO UPDATE SET` for idempotent operations. Works in SQLite.
- **Hono test requests**: Accept env bindings as 3rd argument to `app.request()` — no need for real D1 in tests.
- **Expo push tokens**: Only work on physical devices, not simulators. Use `expo-device` to guard.
- **Expo push handler**: `setNotificationHandler` must be called at module level (not inside a component).
- **EAS Build in CI**: Use `expo/expo-github-action@v8` with `--non-interactive --no-wait`. Android only until iOS creds are set up.
- **Token rotation**: Register an `addPushTokenSubscription` listener to catch OS-level token changes and re-register.
- **Deep links**: Handle both cold start (`Linking.getInitialURL()`) and warm start (`addDeepLinkListener()`) separately.
- **App Bridge stores**: Create at module level, not inside components. Use immer-style producers for state updates.
- **React Native WebView**: The `BridgedWebView` wrapper injects bridge scripts automatically — don't manually inject.
- **tsup with composite tsconfig**: If a package has multiple source files, set `composite: false` in the package tsconfig or tsup's DTS build fails with "file not listed" errors.
- **BridgeStores type constraint**: Use `type` (not `interface`) for store definitions — interfaces lack the implicit index signature that `BridgeStores` requires.

- **Keyboard: React Native's KeyboardAvoidingView is wrong away from the top of the window**: it computes the overlap from its `onLayout` frame (relative to its parent), so inside an onboarding pager page (84 points down) it fell 84 points short and Next stayed under the keyboard. And in a modal sheet (Fabric) even `measureInWindow` measures from the sheet's top, not the display's. `components/ogs/KeyboardFooter.tsx` measures in the window, adds a sheet's offset (sheets sit on the bottom: window height - sheet height), and pins the form's main action in a footer above the keyboard; `Screen` takes a `footer`, and a plain `Screen` uses `automaticallyAdjustKeyboardInsets` (native, window-correct) to scroll a focused field above the keyboard.
- **Every enclosing ScrollView needs `keyboardShouldPersistTaps="handled"`**: a button outside the inner ScrollView but inside an outer one (the onboarding FlatList pager) only closes the keyboard on the first tap, unless the outer one says "handled" too. Same for a horizontal picker inside a form (the sticker row).
- **Detox can't see an InputAccessoryView**: the bar lives in the keyboard's window, which Detox doesn't search; and Detox's `toBeVisible` ignores the keyboard window, so only a `tap()` that creates something proves a button isn't under the keyboard.

## Architecture

- **Error response consistency**: Every API error must use `{ error: { code, message, status } }`. Don't mix formats.
- **Push providers are stubs**: APNs needs Apple .p8 key + JWT signing + HTTP/2. FCM needs Firebase service account + HTTP v1 API. Both are non-trivial integrations.
- **notification-kit bulk send**: Currently sends N individual requests via `Promise.allSettled()`. Needs a batch API endpoint.
- **D1 mocking**: Mock the `prepare().bind().run()`/`.first()` chain with `vi.fn()`. Inspect the SQL string to route different queries to different return values.
- **Observable store pattern (mobile)**: Decouples URL sources from WebView consumer without adding Redux/Zustand.
- **Cast-kit standalone bridge was a mistake**: Building a separate bridge (WebViewBridge, HttpBridge) duplicated app-bridge and caused architecture mismatch in trivia-jam. Casting state is just another app-bridge store. Follow the notification-kit pattern.
- **TV rendering: stream-kit, not browser-on-TV**: Chromecast's built-in browser is slow and limited. Server-side rendering via stream-kit + WebRTC video streaming gives consistent quality. The TV receiver is just a `<video>` element.
- **SDK components should be headless**: Styled components (CastButton, etc.) belong in the consuming app, not the SDK. SDKs export hooks and types; apps compose the UI.
- **Cloudflare Containers: can't add to existing Worker**: Deploying a Worker with `containers` config creates a container image registry tied to that Worker name. If the registry wasn't created with the Worker originally, it won't auto-create later — even after deleting and recreating the Worker. The DO metadata also persists across Worker deletion and requires explicit `deleted_classes` migration. Keep containers on their own Worker until Cloudflare fixes this.
- **Cloudflare DO metadata survives Worker deletion**: `wrangler delete` removes the script but not the Durable Object class registry. Redeploying without the DO class requires a `deleted_classes` migration in wrangler.toml. Once the migration runs, the entries can be removed.
- **Cloudflare container registry is per-Worker and can't auto-create**: The registry was provisioned during beta onboarding for `bun-stream-server`. New Worker names get "The image registry does not exist" — both locally and in CI. Not an OrbStack issue. Workaround: reuse the existing Worker name, or file a Cloudflare support ticket to provision a new registry.
- **Dual React with `link:` dependencies**: When a consuming app uses `link:../monorepo/packages/foo`, the linked package resolves React from its own `node_modules/`, not the consumer's. This causes "Cannot read properties of null (reading 'useMemo')" crashes. Fix: add Vite `resolve.alias` to force React resolution to the consumer's copy.

## Testing

- **Jest + Expo**: Requires `jest-expo` preset and careful `transformIgnorePatterns` to allow `@open-game-system/*` packages through.
- **Stryker mutation testing**: Track surviving mutants. Log-string mutants are acceptable survivors.
- **Vitest workspace**: When adding a new package with tests, add its vitest config to the workspace if using a shared vitest workspace file.

- **A hook that derives state from props must return the same object when nothing changed**: the launcher's `nextFrames` returned a fresh `{active:null, parked}` every render while a game waited for its TV view, the effect saw "new frames" and looped ("Maximum update depth exceeded"). Pure reducers feeding `useEffect`/`setState` need an identity test.
- **The e2e framework pins its own Playwright**: `@e2e-dev/web` uses playwright-core 1.63 (Chromium build 1243), separate from the repo's Playwright. If `playwright install` times out, download the Chrome for Testing zip it names and unzip into `~/Library/Caches/ms-playwright/chromium-<build>/` with `INSTALLATION_COMPLETE` + `DEPENDENCIES_VALIDATED` markers.
- **Screenshot after the cut-over, not after the DOM**: the launcher's box↔fullscreen transition runs after the state change; wait for `[data-testid=player][data-phase=hidden]` before capturing home.
- **Game art for the launcher: crop out the HUD**: game screenshots carry HUD rows and faced UI props (smiling planets/stars). Manifest `art.safe` (scale + origin) crops them; check every hero/tile by eye.

- **`wrangler dev` hot-reloads from the working tree**: the shared local API (8788) runs from `services/api`, so a commit (or even a save) there reaches it immediately, against its old local D1. A schema change then breaks the owner's running app. Run your own copy with `--port <other> --persist-to <scratch dir>` and restart the shared one (wiping `.wrangler/state/v3/d1`, `pnpm db:local`) only when you mean to.
- **Sign-in tests use vercel-labs/emulate, not real providers**: Apple/Google ID tokens come from `POST /auth/authorize/callback` (Apple) or `/o/oauth2/v2/auth/callback` (Google) with a seeded user's email, then the token endpoint. Apple's `email_verified` is the string `"true"`, Google's a boolean. Workers in vitest-pool-workers can fetch the emulators on localhost.
- **Email (Cloudflare Email Service) needs no emulator locally**: `wrangler dev` (4.147+, miniflare 5) simulates a `send_email` binding: nothing is delivered, `send()` returns a `messageId`, the text/html land under `.wrangler/tmp/email/`, and the Local Explorer lists every sent message (to, subject, sentAt; `?email_id=` adds text/html) at `GET http://localhost:<port>/cdn-cgi/local/explorer/api/local/email/sending`. It answers only a localhost `Host` (403 otherwise) and lists mail from every local dev session, so filter by a unique `to`. vitest-pool-workers turns the Local Explorer off, so integration tests replace the binding: `miniflare.email = { send_email: [] }` (the pool merges objects with `Object.assign`, so this drops wrangler's binding) plus `serviceBindings.SEND_EMAIL` → a recording `WorkerEntrypoint` auxiliary worker. Send `from` as `{ email, name }`; the address must be in `allowed_sender_addresses` and on a domain onboarded to Email Sending.
- **New tables: apply them to the shared local D1 right after committing**: friends (slice 2) added `profile_seen`, written by `anyToken` on every phone/tablet call, so the shared 8788 (hot-reloaded from the tree, old D1) answered 500 to every authed call until the schema was applied. After any schema commit run `cd services/api && pnpm db:local` (only `CREATE ... IF NOT EXISTS`, never drop or wipe the shared DB), and keep schema changes additive (new tables over new columns, since `CREATE TABLE IF NOT EXISTS` never adds a column to an existing table).

- **"Newest first" in SQLite needs a tiebreak that moves on every write**: `ORDER BY updated_at DESC, rowid DESC` flipped under load because two writes in one millisecond tie on `updated_at` and `ON CONFLICT DO UPDATE` keeps the row's old rowid. `INSERT OR REPLACE` gives each write a fresh rowid (max + 1), so `rowid DESC` is the most recent write; tests freeze `Date.now` to pin the tie.

- **CRAP of services/api needs Node-side route tests**: coverage from the workerd integration suite can't be collected (`@vitest/coverage-istanbul` fails inside vitest-pool-workers with "template is not a function"). `test/support/d1.ts` gives Node tests a real local D1 (wrangler `getPlatformProxy`, schema.sql applied, `reset()` between tests), so `app.request(path, init, { DB })` route tests are measured. Measure with `scripts/crap.mjs` (AST-based); the regex crap4ts misses inline Hono handlers.

- **Inlining a workspace package with tsdown: prefer its ESM build**: profile-kit bundles app-bridge-web (main = cjs, module = esm, no `exports` map). Rolldown resolved `main`, inlined the CJS and emitted `import { createRequire } from "node:module"` for its `require("fast-json-patch")`, which breaks every game's esbuild browser bundle. Set `inputOptions.resolve.mainFields: ["module", "main"]`; `src/dist.test.ts` bundles the dist with esbuild `platform: "browser"` and fails on any `node:` import.
- **Games get packages from packed tarballs**: ogs-protocol and the workspace app-bridge versions are not on npm, so a package games install (profile-kit) bundles them (`deps.alwaysBundle`) and keeps only npm deps (zod, fast-json-patch, react) external. Re-pack with `pnpm pack` and re-vendor with `pnpm install --force` (same file name, new integrity).
- **Game tokens never touch the app token**: the game WebView gets a token for that game only (`profile` bridge store); the TV page gets the session's game token in `ogs:start`. A frame that attaches its listener after `load` says `ogs:ready` and the launcher re-sends the start.

## Process

- **Monorepo consolidation (2026-03-13)**: Merged 5 repos. Key issues were import path changes (`app-bridge` → `app-bridge-web`/`app-bridge-react`), vitest version mismatches (v4 needs vite v6+), and React types version conflicts across packages.
- **README is aspirational for notification-kit**: The README documents planned features not yet built. Grow code toward the README, not vice versa.

- **Metro caches EXPO_PUBLIC_* values between Release builds**: switching `EXPO_PUBLIC_FAKE_CAST` (or any EXPO_PUBLIC_ value) between builds is silently ignored when Metro reuses its cache. Build with `EXTRA_PACKAGER_ARGS=--reset-cache` whenever env values change.
- **Codex as a design judge**: `codex exec` needs `--skip-git-repo-check` outside the repo root, and the prompt must go in on stdin when images are passed with `-i` (with `-i … "prompt"` it hangs on "Reading prompt from stdin").
