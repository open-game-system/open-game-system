// Porchlight's own glyphs: drawn, not borrowed. No faces on objects.
interface P {
  size?: number;
  className?: string;
}

/** The mark: a porch lamp hung under an eave, lit. */
export function Lamp({ size = 28, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="19" r="11" fill="var(--pl-glow, #f2b544)" opacity="0.28" />
      <path d="M4 7.5 16 3l12 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4v5" stroke="currentColor" strokeWidth="2" />
      <path d="M11.5 11h9l-1.2 11.5h-6.6Z" fill="var(--pl-lamp, #f2b544)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.5 22.5h11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 9.5h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PhoneGlyph({ size = 16, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="1.5" width="8" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 12.3h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TabletGlyph({ size = 16, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="12.2" r=".9" fill="currentColor" />
    </svg>
  );
}

export function TvGlyph({ size = 16, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Battery({ level, size = 22, className }: P & { level: number }) {
  const low = level < 0.2;
  return (
    <svg className={className} width={size} height={size * 0.5} viewBox="0 0 24 12" aria-hidden="true">
      <rect x="1" y="1" width="19" height="10" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="2.8" y="2.8" width={Math.max(1.6, 15.4 * level)} height="6.4" rx="1.2" fill={low ? "var(--pl-alarm, #b3261e)" : "currentColor"} />
    </svg>
  );
}

export function Plug({ size = 20, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3v5M16 3v5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M5.5 8h13v3.5a6.5 6.5 0 0 1-13 0Z" fill="currentColor" />
      <path d="M12 18v3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Check({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4.5 10.5 3.6 3.6 7.4-8.2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron({ size = 16, className, dir = "right" }: P & { dir?: "right" | "left" | "down" }) {
  const rot = dir === "left" ? 180 : dir === "down" ? 90 : 0;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Swap({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 7h11l-3-3M16.5 13h-11l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Undo({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5 3.5 8.5 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Pin({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="8" r="5.5" fill="currentColor" />
      <circle cx="8.2" cy="6.4" r="1.6" fill="#fff" opacity=".55" />
    </svg>
  );
}

export function Moon({ size = 40, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M27 5a15 15 0 1 0 8 25A13 13 0 0 1 27 5Z" fill="currentColor" />
    </svg>
  );
}

export function Shield({ size = 18, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5 3.8 5v4.6c0 3.9 2.6 6.6 6.2 7.9 3.6-1.3 6.2-4 6.2-7.9V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m7 10 2.2 2.2L13.3 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
