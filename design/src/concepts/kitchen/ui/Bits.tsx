import type { ReactNode } from "react";
import { HOME } from "../../../world";
import { Battery, Lamp, PhoneGlyph, TabletGlyph } from "./Icons";
import { THIS_PHONE } from "../household";

export function StatusBar({ time, dark }: { time: string; dark?: boolean }) {
  return (
    <div className={`pl-status${dark ? " pl-status--dark" : ""}`} aria-hidden="true">
      <span>{time}</span>
      <span className="pl-status-r">
        <Battery level={0.71} size={24} />
      </span>
    </div>
  );
}

export function Wordmark({ size = "m" }: { size?: "m" | "tv" }) {
  return (
    <span className={`pl-wordmark pl-wordmark--${size}`}>
      <Lamp size={size === "tv" ? 44 : 22} />
      <span>Porchlight</span>
    </span>
  );
}

/** "This phone" / "iPad · 82%" with the right glyph; low battery says so in words too. */
export function DeviceLine({ personId, short }: { personId: string; short?: boolean }) {
  const d = HOME.devices.find((x) => x.personId === personId);
  if (!d) return <span>No device</span>;
  const glyph = d.kind === "ipad" ? <TabletGlyph size={14} /> : <PhoneGlyph size={14} />;
  const pct = d.battery !== undefined ? Math.round(d.battery * 100) : undefined;
  const low = pct !== undefined && pct < 20;
  const label = d.id === THIS_PHONE ? "This phone" : d.kind === "ipad" ? "iPad" : "iPhone";
  return (
    <span className={`pl-devline${low ? " pl-devline--low" : ""}`}>
      {glyph}
      <span>{label}</span>
      {d.kind === "ipad" && pct !== undefined && !short && <span>{pct}%</span>}
    </span>
  );
}

export function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pl-section ${className ?? ""}`}>
      <div className="pl-section-head">
        <h2 className="pl-h2">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
