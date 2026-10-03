// Stand-in for Rocket Crew's Fixer pad: no words, four huge glossy parts to tap, nothing to leave.
import type { CSSProperties, ReactNode } from "react";

const glossy = (bg: string): CSSProperties => ({
  borderRadius: 64,
  background: `radial-gradient(70% 55% at 35% 25%, rgba(255,255,255,0.55), transparent 60%), ${bg}`,
  boxShadow: "inset 0 -14px 0 rgba(0,0,0,0.22), 0 18px 30px -12px rgba(0,0,0,0.6)",
  display: "grid",
  placeItems: "center",
  color: "#1b0f3a",
});

function Part({ bot, bg, onTap, children }: { bot: string; bg: string; onTap: () => void; children: ReactNode }) {
  return (
    <button data-bot={bot} aria-label="" onClick={onTap} className="pf-kidpart" style={glossy(bg)}>
      {children}
    </button>
  );
}

export function RocketKid({ onTap, pokes }: { onTap: () => void; pokes: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(90% 50% at 70% 20%, #5b2a9a 0%, transparent 70%), radial-gradient(80% 50% at 20% 90%, #3a1f78, transparent 70%), #1b0f3a" }}>
      <svg viewBox="0 0 820 1180" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 197) % 820} cy={(i * 331) % 1180} r={(i % 3) + 1.5} fill="#fff6e0" opacity={0.25 + (i % 4) * 0.12} />
        ))}
        {/* the fin being patched: fills a little with every tap */}
        <g transform="translate(410 250) scale(0.82)">
          <path d="M-60 -170 C -20 -230, 20 -230, 60 -170 L 70 120 L -70 120 Z" fill="#f4eef8" stroke="#fff" strokeWidth="6" />
          <path d="M-70 40 L -170 160 L -70 130 Z" fill={pokes % 2 ? "#ff5fa2" : "#b33a72"} stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          <path d="M70 40 L 170 160 L 70 130 Z" fill="#ff5fa2" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          <circle cx="0" cy="-90" r="34" fill="#9fe6ff" stroke="#fff" strokeWidth="8" />
          <path d="M-40 130 L 0 220 L 40 130 Z" fill="#ffd23f" opacity="0.9" />
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} cx={-150 + i * 20} cy={150 - i * 16} r="9" fill={i < (pokes % 7) ? "#ffd23f" : "rgba(255,255,255,0.25)"} />
          ))}
        </g>
      </svg>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 70, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <Part bot="kid-wrench" bg="#ff5fa2" onTap={onTap}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#1b0f3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6.5a4 4 0 015 5l-2-.5-1.5 1.5.5 2a4 4 0 01-5-5L4 17l3 3 7.5-7.5" /></svg>
        </Part>
        <Part bot="kid-star" bg="#ffd23f" onTap={onTap}>
          <svg width="130" height="130" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#1b0f3a" /></svg>
        </Part>
        <Part bot="kid-bolt" bg="#7fe0ff" onTap={onTap}>
          <svg width="120" height="120" viewBox="0 0 24 24"><path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="#1b0f3a" /></svg>
        </Part>
        <Part bot="kid-ring" bg="#8ff0b5" onTap={onTap}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#1b0f3a" strokeWidth="3"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="#1b0f3a" /></svg>
        </Part>
      </div>
    </div>
  );
}
