// Build-time switches on top of app.json, each off unless its env var is set at prebuild / EAS build:
// - DETOX_ANDROID=1: the Detox test wiring for Android (plugins/with-detox-android.js). Store builds,
//   EAS builds and the native fingerprint never see it.
// - OGS_LIVE_ACTIVITIES=1: iOS Live Activities (the shell's OgsLiveActivity widget extension and app
//   group; docs/exec-plans/active/2026-10-21-live-activities.md). Ships dark until Jon turns it on.
module.exports = ({ config }) => {
  const extra = [];
  if (process.env.DETOX_ANDROID === "1") extra.push("./plugins/with-detox-android");
  if (process.env.OGS_LIVE_ACTIVITIES === "1")
    extra.push(require("@open-game-system/shell/plugin").withShellLiveActivity);
  return extra.length === 0
    ? config
    : { ...config, plugins: [...(config.plugins ?? []), ...extra] };
};
