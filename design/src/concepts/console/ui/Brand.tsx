// The console's mark and the person portraits it uses everywhere.
import type { Person } from "../../../world";
import { Sticker } from "./Sticker";

/** The OGS mark: a "home ring". An open ring (the room) around a solid core (tonight). */
export function Mark({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3.5a12.5 12.5 0 1 1-10.8 6.2" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="5.2" fill={color} />
    </svg>
  );
}

export function Wordmark({ color = "currentColor", size = 20 }: { color?: string; size?: number }) {
  return (
    <span className="cx-wordmark" style={{ color, fontSize: size }}>
      <Mark size={size * 1.15} color={color} />
      <span>OGS</span>
    </span>
  );
}

/**
 * A person, as the console knows them: the painted paper sticker they picked (ui/Sticker.tsx). Kept
 * under this name because every surface uses it. `ring` is accepted for old callers and ignored:
 * identity is the character, never a coloured ring.
 */
export function Portrait({ person, size = 40, dim = false }: { person: Person; size?: number; ring?: boolean; dim?: boolean }) {
  return <Sticker person={person} size={size} dim={dim} className="cx-portrait" />;
}

export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`cx-status ${dark ? "cx-status--dark" : ""}`}>
      <span>7:10</span>
      <span className="cx-status__icons" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12">
          <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
          <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity=".5" />
          <rect x="2" y="2" width="14" height="8" rx="1.6" fill="currentColor" />
          <rect x="23.5" y="4" width="1.8" height="4" rx=".8" fill="currentColor" fillOpacity=".5" />
        </svg>
      </span>
    </div>
  );
}
