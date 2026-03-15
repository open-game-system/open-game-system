# OGS App Implementation Progress

## Acceptance Test Implementation Status

| Feature File | Scenarios | Detox Tests | Status |
|---|---|---|---|
| ogs-app-onboarding | 12 | 6/12 | **Done** (consolidated into user journeys) |
| ogs-app-home-screen | 13 | 11/13 | **Done** (Continue section deferred to continue-lifecycle) |
| ogs-app-game-detail | 6 | 5/6 | **Done** (launch-creates-entry deferred) |
| ogs-app-game-screen | 18 | 2/18 | **Partial** (loading/error/swipe states need full-bleed redesign) |
| ogs-app-continue-lifecycle | 26 | 0/26 | **Pending** (needs game history e2e infrastructure) |
| ogs-app-settings | 18 | 6/18 | **Done** (dev tools screen + debug overlay deferred) |
| ogs-app-lifecycle | 14 | 2/14 | **Partial** (bg/fg + force quit done; deep links/offline/push deferred) |

## Total: 32 Detox tests across 7 suites

## Infrastructure

- [x] Detox installed and configured
- [x] iOS simulator Release builds working
- [x] Test helpers (skipOnboarding, freshLaunchWithOnboardingDone)
- [x] Test fixture game (examples/test-static-game/)
- [ ] Mock server (apps/mobile/e2e/mock-server/) — needed for Continue lifecycle
- [ ] Deep link testing infrastructure
- [ ] Push notification testing infrastructure
- [ ] Offline state simulation

## Implemented Features

- [x] 3-page onboarding flow (persisted via AsyncStorage)
- [x] Home screen — Direction C editorial (Your Games + Discover)
- [x] Game directory — 4 static games with icons, descriptions, tags, features
- [x] Game detail screen — hero, tags, description, OGS features, Play CTA
- [x] Settings — notifications, developer mode, debug overlay, about
- [x] Navigation — home ↔ game detail ↔ game, home → settings
- [x] Game history — recent games tracked, shown in Continue section
- [x] Focus reload — home screen refreshes game history on navigation focus

## Key Decisions

- Tests use `freshLaunchWithOnboardingDone` (delete:true) per test for isolation
- Onboarding tests use sequential user journeys (3 describe blocks, 3 delete:true)
- Global `setup.ts` has beforeAll(launchApp) + beforeEach(reloadReactNative)
- WebView tests use `device.disableSynchronization()` around WebView interactions
- Simulator may need reboot after long test sessions (resource exhaustion)
