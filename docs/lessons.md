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
- **OrbStack Docker can't push to Cloudflare container registry**: Local deploys with OrbStack fail at the registry push step. CI (standard Docker) works fine. Use CI for container deployments.

## Testing

- **Jest + Expo**: Requires `jest-expo` preset and careful `transformIgnorePatterns` to allow `@open-game-system/*` packages through.
- **Stryker mutation testing**: Track surviving mutants. Log-string mutants are acceptable survivors.
- **Vitest workspace**: When adding a new package with tests, add its vitest config to the workspace if using a shared vitest workspace file.

## Process

- **Monorepo consolidation (2026-03-13)**: Merged 5 repos. Key issues were import path changes (`app-bridge` → `app-bridge-web`/`app-bridge-react`), vitest version mismatches (v4 needs vite v6+), and React types version conflicts across packages.
- **README is aspirational for notification-kit**: The README documents planned features not yet built. Grow code toward the README, not vice versa.
