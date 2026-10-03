// Spine glyphs: drawn in one line weight, never per game.
interface G { size?: number; color?: string }

export const TvGlyph = ({ size = 22, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="12.5" rx="2" />
    <path d="M8 20.5h8M12 17v3.5" />
  </svg>
);

export const DeckGlyph = ({ size = 22, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
    <rect x="6" y="3" width="12" height="15" rx="1.5" />
    <path d="M4 7.5v12a1.5 1.5 0 0 0 1.5 1.5H15" />
  </svg>
);

export const TurnGlyph = ({ size = 22, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12a8 8 0 1 1 2.4 5.7" />
    <path d="M4 18v-4.5h4.5" />
  </svg>
);

export const ChevronUp = ({ size = 14, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 9l4-4 4 4" />
  </svg>
);

export const ChevronLeft = ({ size = 18, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 3.5L5.5 9l5.5 5.5" />
  </svg>
);

export const MoonGlyph = ({ size = 22, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
);

export const BatteryLow = ({ size = 40, color = "#ff6a45" }: G) => (
  <svg width={size} height={size / 2} viewBox="0 0 40 20" fill="none" aria-hidden>
    <rect x="1.5" y="1.5" width="33" height="17" rx="4" stroke="currentColor" strokeWidth="2.5" />
    <rect x="36" y="6.5" width="3" height="7" rx="1.5" fill="currentColor" />
    <rect x="4.5" y="4.5" width="4" height="11" rx="1.5" fill={color} />
  </svg>
);

export const PlugGlyph = ({ size = 40, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4v8M26 4v8" />
    <path d="M9 12h22v6a11 11 0 0 1-22 0z" />
    <path d="M20 29v8" />
  </svg>
);

export const PlusGlyph = ({ size = 18, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" aria-hidden>
    <path d="M9 3v12M3 9h12" />
  </svg>
);

export const CheckGlyph = ({ size = 18, color = "currentColor" }: G) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 9.5l3.5 3.5 7.5-8" />
  </svg>
);
