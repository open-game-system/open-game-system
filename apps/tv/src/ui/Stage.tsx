import { type ReactNode, useSyncExternalStore } from "react";

/** The launcher is drawn at 1920×1080 and scaled to whatever the receiver gives it. */
const W = 1920;
const H = 1080;

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const scale = () => Math.min(window.innerWidth / W, window.innerHeight / H);

export function Stage({ children }: { children: ReactNode }) {
  const s = useSyncExternalStore(subscribe, scale);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${s})` }}>
        {children}
      </div>
    </div>
  );
}
