# Lessons Learned

Persistent record of hard-won knowledge. Add new entries at the bottom of the relevant section.

## EAS Build in CI

- Use `expo/expo-github-action@v8` to set up EAS CLI in GitHub Actions.
- Use `--platform android` only -- iOS builds require Apple Developer credentials and signing certificates that are not available in CI without additional setup.
- Always pass `--no-wait` to avoid 30-60 minute CI hangs. EAS builds run on Expo's servers; without `--no-wait`, the GitHub Actions runner blocks waiting for the remote build to complete, burning CI minutes.
- The `EXPO_TOKEN` secret must be configured in the GitHub repo settings.

## Push Notifications

- Device registration flow: generate UUID via `expo-crypto`, persist in `expo-secure-store`, register with API alongside the Expo push token.
- Token rotation: the OS can rotate push tokens at any time. `Notifications.addPushTokenListener` catches this and re-registers with the API. The listener must be set up with the `ogsDeviceId` so it can send the updated token.
- Push notifications only work on physical devices. `Device.isDevice` must be checked before attempting to register. Simulators/emulators will return null for the push token.
- The Expo push token requires a `projectId` from EAS config. If not found, registration silently fails.
- Foreground notification display requires `setNotificationHandler` to be called at module level (not inside a component).

## Testing

- `jest-expo` preset is required. Using plain `jest` preset causes module resolution failures with Expo/React Native modules.
- `transformIgnorePatterns` must allowlist a large set of React Native ecosystem packages (see `package.json` jest config). New native module dependencies may need to be added here.
- Stryker mutation testing is configured to mutate only `services/**/*.ts`. Surviving mutants in log strings (e.g., `console.log("[Notifications] ...")`) are acceptable -- these are not behavioral and not worth testing.
- Stryker `break` threshold is set to 60%. Below that, CI fails.

## Deep Links

- Universal Links require proper `apple-app-site-association` file hosted at `opengame.org/.well-known/` for iOS and intent filters with `autoVerify: true` for Android.
- Cold start vs warm start URLs must be handled separately: `Linking.getInitialURL()` for cold start, `Linking.addEventListener("url", ...)` for warm start. Both go through the same `extractGameUrl()` parser.
- The game URL store pattern (`game-url-store.ts`) was introduced because the URL source (layout) and the URL consumer (index/WebView) are in different parts of the component tree. A simple module-level variable + listener pattern avoids adding a state management library.

## App Bridge

- `createStore` uses an immer-style producer function for state updates. The `on` config is for side effects that should not modify state (e.g., showing a native dialog).
- The bridge must be created at module level (not inside a component) to avoid re-creation on re-renders.
- Only one store (`castKit`) is registered currently. Additional stores for other kits (notification-kit, auth-kit) will follow the same pattern.
