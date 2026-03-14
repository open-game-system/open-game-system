# Product Specs

Product requirements and vision, organized by domain.
These are the source of truth for WHAT the product does and WHY.

Update these when the product vision or requirements change.
Acceptance tests in `docs/acceptance/` are the testable distillation of these specs.

| Spec File | Covers |
|-----------|--------|
| [push-notifications.md](push-notifications.md) | Device registration, JWT tokens, send notifications, providers |
| [tv-casting.md](tv-casting.md) | Cast device discovery, session lifecycle, stream-kit rendering, receiver |

## Domains to Document

- Push notifications (device registration, send, bulk, providers)
- Cloud rendering / streaming (session lifecycle, WebRTC, casting)
- App bridge (WebView-native communication, store protocol)
- Mobile app (deep linking, push token management, cast integration)
- Developer SDK experience (notification-kit, stream-kit usage)
