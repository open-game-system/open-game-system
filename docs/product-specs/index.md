# Product Specs

Product requirements and vision, organized by domain.
These are the source of truth for WHAT the product does and WHY.

Update these when the product vision or requirements change.
Acceptance tests in `docs/acceptance/` are the testable distillation of these specs.

| Spec File | Covers |
|-----------|--------|
| [push-notifications.md](push-notifications.md) | Device registration, JWT tokens, send notifications, providers |
| [tv-casting.md](tv-casting.md) | Cast device discovery, session lifecycle, stream-kit rendering, receiver |
| [ogs-profiles.html](ogs-profiles.html) | OGS profiles replace households: profile + @id + sticker at onboarding (everyone a full profile), optional back-up via Apple/Google/email, Friends and Profile tabs, TV session = whoever joined the cast, signed game-scoped profile token passed to games (bridge `profile` store, `ogs:start.token`), decisions recorded |
| [ogs-app-v3.html](ogs-app-v3.html) | App rework v3 (current): Playing · TV · Library tabs, live game pinned + return pill, Add games inside Library, cast optional, games inside one stream |
| [ogs-app-v2.html](ogs-app-v2.html) | App rework v2: library-first (Library · Shop tabs), optional cast via an on-TV bar with the remote, games inside one stream, launch from phone or TV, build plan |
| [cast-first.html](cast-first.html) | App rework: cast first, TV launcher, phone as controller (tab bar + swipe back), games inside one stream, build plan |

## Domains to Document

- Push notifications (device registration, send, bulk, providers)
- Cloud rendering / streaming (session lifecycle, WebRTC, casting)
- App bridge (WebView-native communication, store protocol)
- Mobile app (deep linking, push token management, cast integration)
- Developer SDK experience (notification-kit, stream-kit usage)
