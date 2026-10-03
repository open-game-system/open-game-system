import { useEffect, useMemo, useState } from "react";
import { DEVICE_SIZE, type Device, type RegisteredConcept } from "./types";
import { DeviceFrame } from "./DeviceFrame";

// Every device side by side, sharing one session (one store), for flow recordings.
const LAYOUT: { device: Device; scale: number }[] = [
  { device: "tv", scale: 0.64 },
  { device: "phone", scale: 0.92 },
  { device: "ipad", scale: 0.66 },
];
export const STAGE_VIEWPORT = { width: 2240, height: 900 };

declare global {
  interface Window {
    __ogsMark?: (text: string) => void;
  }
}

export function Stage({ concept, scenarioId, flowId, onReady }: { concept: RegisteredConcept; scenarioId: string; flowId: string | null; onReady: (ack: string) => void }) {
  const Bound = useMemo(() => concept.session(scenarioId), [concept, scenarioId]);
  const flow = concept.flows.find((f) => f.id === flowId);
  const [mark, setMark] = useState(flow ? flow.label : scenarioId);
  const [taps, setTaps] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    window.__ogsMark = setMark;
    const onDown = (e: PointerEvent) => {
      const id = performance.now();
      setTaps((t) => [...t, { x: e.clientX, y: e.clientY, id }]);
      setTimeout(() => setTaps((t) => t.filter((x) => x.id !== id)), 700);
    };
    window.addEventListener("pointerdown", onDown, true);
    if (Bound) onReady(`${concept.id}/${scenarioId}/stage`);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [Bound, concept.id, scenarioId, onReady]);

  if (!Bound) return <div style={{ padding: 40, color: "#b00020", font: "600 28px system-ui" }}>no scenario {scenarioId}</div>;
  return (
    <div style={{ width: STAGE_VIEWPORT.width, height: STAGE_VIEWPORT.height, background: "#16151a", color: "#eee", font: "500 15px system-ui", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 24, top: 10, right: 24, display: "flex", gap: 16, alignItems: "baseline" }}>
        <b style={{ fontSize: 18 }}>{concept.name}</b>
        <span style={{ opacity: 0.6 }}>{flow ? flow.label : scenarioId}</span>
      </div>
      <div style={{ position: "absolute", top: 44, left: 24, display: "flex", gap: 24, alignItems: "flex-start" }}>
        {LAYOUT.map(({ device, scale }) => {
          const { w, h, label } = DEVICE_SIZE[device];
          return (
            <div key={device}>
              <div style={{ width: w * scale, height: h * scale, borderRadius: device === "tv" ? 6 : 28, overflow: "hidden", boxShadow: "0 0 0 2px #333" }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: device === "tv" ? "none" : "auto" }}>
                  <DeviceFrame device={device}>
                    <Bound device={device} shot={false} />
                  </DeviceFrame>
                </div>
              </div>
              <div style={{ marginTop: 6, opacity: 0.7 }}>{label}</div>
              {device === "tv" && (
                <div data-stage-mark style={{ marginTop: 14, font: "600 30px system-ui", color: "#ffd84a", maxWidth: w * scale }}>
                  {mark}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {taps.map((t) => (
        <div key={t.id} style={{ position: "fixed", left: t.x - 22, top: t.y - 22, width: 44, height: 44, borderRadius: 22, border: "4px solid #ffd84a", pointerEvents: "none", animation: "ogs-tap .7s ease-out forwards" }} />
      ))}
      <style>{`@keyframes ogs-tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}`}</style>
    </div>
  );
}
