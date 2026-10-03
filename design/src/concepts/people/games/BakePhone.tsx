// Stand-in for Bake Shop's own Order reader view, in the game's art direction.
const INK = "#6b3a22";

function Cup({ done }: { done: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 20h22l-3 15H12z" fill={done ? "#f46a8e" : "none"} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 20c0-6 5-10 12-10s12 4 12 10z" fill={done ? "#fff6ea" : "none"} stroke={INK} strokeWidth="2" />
    </svg>
  );
}

export function BakePhone({ dimmed }: { dimmed?: boolean }) {
  return (
    <div
      style={{
        height: "100%",
        background: "linear-gradient(180deg, #ffe6c4 0%, #fff1d6 40%)",
        color: INK,
        fontFamily: "'Baloo 2', 'Arial Rounded MT Bold', sans-serif",
        padding: "20px 20px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        filter: dimmed ? "saturate(0.5) brightness(0.7)" : undefined,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em" }}>ORDER READER · DAY 4</div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05 }}>Order 4 of 5</div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Cup key={i} done={i < 3} />
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 26, background: "#fffaf0", boxShadow: "0 2px 0 #f0d9b5", padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <img src="/art/bake-shop/char-bear.webp" alt="" style={{ height: 150, objectFit: "contain" }} />
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em" }}>READ IT OUT LOUD</div>
        <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}>"A strawberry cupcake, please, with mint sprinkles on top!"</p>
      </div>
      <button data-bot="bs-next" style={{ height: 64, borderRadius: 22, background: INK, color: "#fff6ea", fontSize: 22, fontWeight: 800, fontFamily: "inherit", textAlign: "center" }}>
        <span>Ring the bell: order up</span>
      </button>
    </div>
  );
}
