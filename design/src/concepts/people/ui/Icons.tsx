// Line icons, drawn for this concept (1.8 px stroke, round caps).
import type { ReactNode } from "react";

function Svg({ size = 22, children, label }: { size?: number; children: ReactNode; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
      {children}
    </svg>
  );
}

export const IconBack = () => (
  <Svg>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IconTv = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="12" rx="2.5" />
    <path d="M8 20h8" />
  </Svg>
);
export const IconSwap = () => (
  <Svg>
    <path d="M5 8h12l-3-3M19 16H7l3 3" />
  </Svg>
);
export const IconCheck = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconPeople = () => (
  <Svg>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5" />
    <circle cx="16.5" cy="8" r="2.6" />
    <path d="M16 13.2c2.2.1 3.9 1.6 4.5 4.3" />
  </Svg>
);
export const IconGames = () => (
  <Svg>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);
export const IconHome = () => (
  <Svg>
    <path d="M4 11l8-6.5 8 6.5V20H4z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);
export const IconUndo = () => (
  <Svg size={20}>
    <path d="M9 7L5 11l4 4" />
    <path d="M5 11h9a5 5 0 010 10h-3" />
  </Svg>
);
export const IconBell = () => (
  <Svg size={20}>
    <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 004 0" />
  </Svg>
);
export const IconBattery = ({ level, size = 22 }: { level: number; size?: number }) => (
  <Svg size={size}>
    <rect x="2.5" y="7.5" width="17" height="9" rx="2.2" />
    <path d="M21.5 10.5v3" />
    <rect x="4.5" y="9.5" width={Math.max(1.2, 13 * level)} height="5" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconPhone = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const IconTablet = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const IconLock = () => (
  <Svg size={18}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Svg>
);
