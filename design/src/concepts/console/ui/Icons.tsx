// Small line icons, drawn for this concept. 24-unit grid, currentColor.
import type { ReactNode } from "react";

function Svg({ size = 24, children, label }: { size?: number; children: ReactNode; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
      {children}
    </svg>
  );
}

export const TvIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="2.5" y="4.5" width="19" height="12.5" rx="1.5" />
    <path d="M8 20.5h8" />
  </Svg>
);
export const PhoneIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const TabletIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const Check = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const Chevron = ({ size, dir = "right" }: { size?: number; dir?: "right" | "left" | "down" }) => (
  <Svg size={size}>
    <path d={dir === "right" ? "M9 5l7 7-7 7" : dir === "left" ? "M15 5l-7 7 7 7" : "M5 9l7 7 7-7"} />
  </Svg>
);
export const Plus = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const Undo = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Svg>
);
export const Bell = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 004 0" />
  </Svg>
);
export const Library = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="4" width="7.5" height="7.5" rx="1" />
    <rect x="13.5" y="4" width="7.5" height="7.5" rx="1" />
    <rect x="3" y="14.5" width="7.5" height="5.5" rx="1" />
    <rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1" />
  </Svg>
);
export const People = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
    <path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.8c1.8.8 3 2.5 3.5 5.2" />
  </Svg>
);
export const Moon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
  </Svg>
);
export const Battery = ({ size, level }: { size?: number; level: number }) => (
  <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" aria-hidden>
    <rect x="2" y="7" width="18" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="21" y="10" width="1.6" height="4" rx=".8" fill="currentColor" />
    <rect x="4" y="9" width={Math.max(1.2, 14 * level)} height="6" rx="1.2" fill={level < 0.2 ? "#E5484D" : "currentColor"} />
  </svg>
);
export const Spinner = ({ size = 18 }: { size?: number }) => (
  <svg className="cx-spin" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
    <path d="M12 3a9 9 0 019 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
export const Gamepad = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M7 8h10a4.5 4.5 0 014.4 5.4l-.7 3.4a2.4 2.4 0 01-4.2 1L15 16H9l-1.5 1.8a2.4 2.4 0 01-4.2-1l-.7-3.4A4.5 4.5 0 017 8z" />
    <path d="M7.5 11v3M6 12.5h3" />
    <circle cx="16" cy="12" r=".6" fill="currentColor" />
  </Svg>
);
export const Lock = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Svg>
);
export const Eye = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const Close = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
