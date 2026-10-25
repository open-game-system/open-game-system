import type { RxLog } from "./rx-log";

/**
 * Keeps the TV from dimming into its screensaver while the launcher is up (Google TV's ambient
 * mode came on under a cast, owner 2026-10-10): a Screen Wake Lock, taken again whenever the page
 * shows again; without one, a tiny muted looping clip (keepawake.mp4/.webm, the NoSleep.js way).
 * Each step is a receiver.keepawake event {method, ok, step}.
 */
export function keepAwake(log: Pick<RxLog, "event">) {
  let clip: HTMLVideoElement | null = null;
  const said = (method: string, ok: boolean, step: string, error?: unknown) =>
    log.event("keepawake", {
      level: ok ? "info" : "warn",
      ...(error ? { error } : {}),
      data: { method, ok, step },
    });

  const playClip = (step: string) => {
    if (!clip) {
      clip = document.createElement("video");
      clip.muted = true;
      clip.loop = true;
      clip.playsInline = true;
      clip.setAttribute("aria-hidden", "true");
      clip.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;top:0";
      const sources: [string, string][] = [
        ["/keepawake.mp4", "video/mp4"],
        ["/keepawake.webm", "video/webm"],
      ];
      for (const [src, type] of sources) {
        const s = document.createElement("source");
        s.src = src;
        s.type = type;
        clip.append(s);
      }
      document.body.append(clip);
    }
    clip.play().then(
      () => said("video", true, step),
      (e: unknown) => said("video", false, step, e),
    );
  };

  const request = (step: string) => {
    const wl = navigator.wakeLock;
    if (!wl) return playClip(step);
    wl.request("screen").then(
      (sentinel) => {
        said("wakeLock", true, step);
        sentinel.addEventListener("release", () => {
          if (document.visibilityState === "visible") request("released");
        });
      },
      (e: unknown) => {
        said("wakeLock", false, step, e);
        playClip(step);
      },
    );
  };

  request("start");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") request("visible");
  });
}
