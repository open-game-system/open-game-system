# Open Game System

A platform enabling web games to leverage native mobile capabilities (push notifications, cloud rendering/streaming) through the OGS companion app.

## Workspace Structure

| Path | Package | Description |
|---|---|---|
| `apps/mobile` | OGS companion app | Expo/React Native mobile app |
| `services/api` | Push notification relay API | Hono + Cloudflare Workers backend |
| **Packages** | | |
| `packages/app-bridge-types` | `@open-game-system/app-bridge-types` | Shared type definitions for app bridge |
| `packages/app-bridge-web` | `@open-game-system/app-bridge-web` | Web-side bridge for communicating with native app |
| `packages/app-bridge-react` | `@open-game-system/app-bridge-react` | React bindings for app bridge |
| `packages/app-bridge-react-native` | `@open-game-system/app-bridge-react-native` | React Native-side bridge implementation |
| `packages/app-bridge-native` | `@open-game-system/app-bridge-native` | Native bridge internals |
| `packages/app-bridge-testing` | `@open-game-system/app-bridge-testing` | Test utilities for app bridge |
| `packages/notification-kit-core` | `@open-game-system/notification-kit-core` | Core push notification logic |
| `packages/notification-kit-react` | `@open-game-system/notification-kit-react` | React hooks for notifications |
| `packages/notification-kit-server` | `@open-game-system/notification-kit-server` | Server-side notification dispatch |
| `packages/stream-kit-types` | `@open-game-system/stream-kit-types` | Shared type definitions for streaming |
| `packages/stream-kit-web` | `@open-game-system/stream-kit-web` | Web-side streaming client |
| `packages/stream-kit-react` | `@open-game-system/stream-kit-react` | React bindings for streaming |
| `packages/stream-kit-server` | `@open-game-system/stream-kit-server` | Server-side streaming orchestration |
| `packages/stream-kit-testing` | `@open-game-system/stream-kit-testing` | Test utilities for streaming |
| **Examples** | | |
| `examples/web-game-demo` | | Demo web game integration |
| `examples/expo-bridge-demo` | | Expo app bridge demo |
| `examples/stream-react-demo` | | React streaming demo |
| `examples/stream-server-demo` | | Server streaming demo |

## Prerequisites

- Node 20+
- pnpm 9.15+

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Documentation

- [System architecture](docs/architecture.md)
- [Monorepo structure](docs/structure.md)
- [Migration status](docs/migration-status.md)
