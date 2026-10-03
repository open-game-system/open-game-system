// The console's mark and the person portraits it uses everywhere.
import type { Person } from "../../../world";

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

/** A person, as the console knows them: painted portrait if a game made one, else their colour + silhouette. */
export function Portrait({ person, size = 40, ring = true, dim = false }: { person: Person; size?: number; ring?: boolean; dim?: boolean }) {
  const style = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 ${Math.max(2, size / 18)}px ${person.color}` : undefined,
    opacity: dim ? 0.45 : 1,
  };
  if (person.portrait) {
    return (
      <span className="cx-portrait cx-portrait--art" style={style}>
        <img src={person.portrait} alt="" />
      </span>
    );
  }
  return (
    <span className="cx-portrait" style={{ ...style, background: person.color }}>
      <svg viewBox="0 0 40 40" width={size * 0.7} height={size * 0.7} aria-hidden>
        <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.92)" />
        <path d="M6 37c2-8 7.5-12 14-12s12 4 14 12z" fill="rgba(255,255,255,.92)" />
      </svg>
    </span>
  );
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
