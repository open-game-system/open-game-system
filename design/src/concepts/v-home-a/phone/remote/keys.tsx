// Glyphs for the remote's keys, drawn on the same 24-unit grid as ui/Icons.
export const PauseKey = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1.4" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.4" fill="currentColor" />
  </svg>
);

export const PlayKey = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" />
  </svg>
);

/** Two arrows passing: one game out, the next one in. */
export const SwapKey = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8h14l-3.5-3.5" />
    <path d="M20 16H6l3.5 3.5" />
  </svg>
);

/** A four-point spark: start something new. */
export const Sparkle = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" fill="currentColor" />
  </svg>
);
