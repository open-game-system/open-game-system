# Monorepo Structure

## Workspace Packages

### SDK Packages (`packages/`)

| Path | npm Name | Purpose | Internal Dependencies |
|------|----------|---------|----------------------|
| `packages/app-bridge-types` | `@open-game-system/app-bridge-types` | Core type definitions for the app-bridge protocol | None |
| `packages/app-bridge-web` | `@open-game-system/app-bridge-web` | Web-side bridge client (runs in WebView) | `app-bridge-types` |
| `packages/app-bridge-react` | `@open-game-system/app-bridge-react` | React hooks for web games using app-bridge | `app-bridge-types`, `app-bridge-web` |
| `packages/app-bridge-native` | `@open-game-system/app-bridge-native` | Native-side bridge host (runs in React Native) | `app-bridge-types` |
| `packages/app-bridge-react-native` | `@open-game-system/app-bridge-react-native` | React Native components wrapping the native bridge | `app-bridge-types`, `app-bridge-native` |
| `packages/app-bridge-testing` | `@open-game-system/app-bridge-testing` | Test utilities and mocks for app-bridge | `app-bridge-types` |
| `packages/notification-kit-core` | `@open-game-system/notification-kit-core` | Shared notification types and logic | None (external `app-bridge` dep) |
| `packages/notification-kit-react` | `@open-game-system/notification-kit-react` | React hooks for receiving notifications in-game | `notification-kit-core` |
| `packages/notification-kit-server` | `@open-game-system/notification-kit-server` | Server SDK for sending notifications via opengame-api | `notification-kit-core` |
| `packages/stream-kit-types` | `@open-game-system/stream-kit-types` | Core type definitions for streaming protocol | None |
| `packages/stream-kit-web` | `@open-game-system/stream-kit-web` | Client-side WebRTC/PeerJS streaming | `stream-kit-types` |
| `packages/stream-kit-react` | `@open-game-system/stream-kit-react` | React hooks for stream lifecycle | `stream-kit-types`, `stream-kit-web` |
| `packages/stream-kit-server` | `@open-game-system/stream-kit-server` | Headless browser renderer (Puppeteer + PeerJS) | `stream-kit-types` |
| `packages/stream-kit-testing` | `@open-game-system/stream-kit-testing` | Test utilities for stream-kit | `stream-kit-types`, `stream-kit-web` |
| `packages/cast-kit-core` | `@open-game-system/cast-kit-core` | Cast store types, Zod schemas, app-bridge helpers | `app-bridge-web` |
| `packages/cast-kit-react` | `@open-game-system/cast-kit-react` | React hooks for cast state and dispatch | `app-bridge-react`, `cast-kit-core` |

### Services (`services/`)

| Path | npm Name | Purpose | Internal Dependencies |
|------|----------|---------|----------------------|
| `services/api` | `opengame-api` | OGS API: push notifications, cast session management (Cloudflare Worker + D1) | None |

### Apps (`apps/`)

| Path | npm Name | Purpose | Internal Dependencies |
|------|----------|---------|----------------------|
| `apps/mobile` | `@open-game-system/mobile` | Host app (Expo/React Native), WebView + bridge | `app-bridge-native`, `app-bridge-react-native`, `app-bridge-types`, `app-bridge-testing` |
| `apps/web` | `@open-game-system/web` | opengame.org marketing website (Vite + React + Tailwind) | None |

### Examples (`examples/`)

| Path | npm Name | Purpose | Internal Dependencies |
|------|----------|---------|----------------------|
| `examples/expo-bridge-demo` | `@open-game-system/app-bridge-example-expo` | Expo demo of app-bridge | `app-bridge-native`, `app-bridge-react-native`, `app-bridge-types` |
| `examples/web-game-demo` | `@open-game-system/app-bridge-example-react` | React web game using app-bridge | `app-bridge-web`, `app-bridge-react`, `app-bridge-types` |
| `examples/stream-react-demo` | `stream-kit-basic-react-demo` | React demo of stream-kit client | `stream-kit-react`, `stream-kit-types`, `stream-kit-web` |
| `examples/stream-server-demo` | `bun-stream-server` | Bun-based stream server demo | None (standalone) |
| `examples/cast-receiver` | `cast-receiver` | Minimal WebRTC receiver page for TV casting | None (vanilla JS) |

## Internal Dependency Resolution

All internal dependencies use the `workspace:*` protocol in `package.json`:

```json
{
  "dependencies": {
    "@open-game-system/app-bridge-types": "workspace:*"
  }
}
```

pnpm resolves `workspace:*` to the local package at install time. When publishing, pnpm replaces it with the actual version number.

## Build Order

Turbo manages the build graph via `dependsOn: ["^build"]` in `turbo.json`. The effective build order (leaves first):

```
Layer 0 (no internal deps):
  app-bridge-types, stream-kit-types, notification-kit-core, opengame-api, stream-server-demo

Layer 1:
  app-bridge-web, app-bridge-native, app-bridge-testing
  stream-kit-web, stream-kit-server
  notification-kit-react, notification-kit-server

Layer 2:
  app-bridge-react, app-bridge-react-native
  stream-kit-react, stream-kit-testing
  cast-kit-core

Layer 3:
  cast-kit-react
  opengame-app, expo-bridge-demo, web-game-demo, stream-react-demo
```

Turbo parallelizes within each layer automatically.

## Test Runners

| Area | Runner | Config |
|------|--------|--------|
| `packages/*` | Vitest | Per-package `vitest.config.ts` (where present) |
| `services/api` | Vitest | `services/api/vitest.config.ts` |
| `apps/mobile` | Jest (Expo preset) | `apps/mobile/jest.config.js` (if present) |
| `examples/*` | None (demo apps) | -- |

Run all tests: `pnpm test` (delegates to `turbo run test`).

## Config Locations

| Config | Location | Purpose |
|--------|----------|---------|
| `turbo.json` | Root | Task pipeline, caching, dependency graph |
| `tsconfig.json` | Root | Base TypeScript config extended by packages |
| `pnpm-workspace.yaml` | Root | Workspace package globs |
| `package.json` | Root | Root scripts, shared devDependencies |
| `.prettierrc` / `prettier` config | Root | Code formatting |
| `tsconfig.json` | Per-package | Extends root, sets package-specific paths |
| `tsup.config.ts` | Per-package (where present) | Bundle config for publishable packages |
| `vitest.config.ts` | Per-package (where present) | Test configuration |
| `wrangler.toml` | `services/api` | Cloudflare Worker config |
| `app.json` | `apps/mobile` | Expo app configuration |
