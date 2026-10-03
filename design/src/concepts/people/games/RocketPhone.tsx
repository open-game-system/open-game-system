// Stand-in for Rocket Crew's own Captain view (the game's web page, in the game's art direction).
const INK = "#fff6e0";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={filled ? "#ffd23f" : "none"} stroke="#ffd23f" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function RocketPhone({ dimmed }: { dimmed?: boolean }) {
  return (
    <div
      style={{
        height: "100%",
        background: "radial-gradient(120% 70% at 80% 10%, #5b2a9a 0%, transparent 60%), radial-gradient(90% 60% at 10% 90%, #3a1f78 0%, transparent 60%), #1b0f3a",
        color: INK,
        fontFamily: "'Lilita One', 'Arial Rounded MT Bold', sans-serif",
        padding: "22px 20px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        filter: dimmed ? "saturate(0.5) brightness(0.55)" : undefined,
        transition: "filter 0.6s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, letterSpacing: "0.12em", color: "#ffd23f" }}>CAPTAIN · MISSION 6</div>
          <div style={{ fontSize: 30, lineHeight: 1.1 }}>To Chilly Island</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Star filled />
        <Star filled />
        <Star filled={false} />
      </div>
      <svg viewBox="0 0 320 150" style={{ width: "100%", flex: 1, minHeight: 0 }} aria-hidden="true">
        <path d="M20 130 C 90 120, 110 40, 180 60 S 280 20, 300 24" fill="none" stroke="rgba(255,246,224,0.35)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
        {[20, 70, 120, 170, 220, 270].map((x, i) => (
          <circle key={x} cx={x + 10} cy={[128, 108, 66, 60, 44, 28][i]} r={i < 4 ? 9 : 7} fill={i < 4 ? "#ff5fa2" : "#3a2a6a"} stroke="#fff6e0" strokeWidth="2" />
        ))}
        <circle cx="300" cy="24" r="16" fill="#9fe6ff" stroke="#fff6e0" strokeWidth="3" />
      </svg>
      <p style={{ font: "500 16px/1.35 'Instrument Sans', sans-serif", color: INK }}>Juneau is patching the left fin. Ava is polishing the window.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button data-bot="rc-boost" style={{ height: 76, borderRadius: 24, background: "#ff5fa2", color: "#1b0f3a", fontSize: 24, boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)", textAlign: "center" }}><span>BOOST</span></button>
        <button data-bot="rc-steer" style={{ height: 76, borderRadius: 24, background: "#ffd23f", color: "#1b0f3a", fontSize: 24, boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)", textAlign: "center" }}><span>STEER</span></button>
      </div>
    </div>
  );
}
