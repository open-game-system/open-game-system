// Stand-in for Bake Shop's Baker pad: a giant cupcake, frosting blobs to tap. No words.
const FROSTINGS = [
  { id: "strawberry", color: "#f46a8e" },
  { id: "mint", color: "#8fddbe" },
  { id: "butter", color: "#ffe08a" },
  { id: "cocoa", color: "#8a5236" },
];

export function BakeKid({ frosting, onFrost, little }: { frosting?: string; onFrost: (c: string) => void; little?: boolean }) {
  const top = FROSTINGS.find((f) => f.id === frosting)?.color ?? "#fff6ea";
  const choices = little ? FROSTINGS.slice(0, 2) : FROSTINGS;
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 40% at 50% 30%, #fff8e8, transparent 70%), linear-gradient(180deg, #ffe2c2, #fff1d6 45%, #f6d7ae)" }}>
      <img src="/art/bake-shop/tv.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "38%", objectFit: "cover", opacity: 0.35, maskImage: "linear-gradient(180deg, #000 30%, transparent)" }} />
      <svg viewBox="0 0 820 700" style={{ position: "absolute", left: 0, right: 0, top: 150, width: "100%" }} aria-hidden="true">
        <ellipse cx="410" cy="640" rx="260" ry="34" fill="#e6c08f" opacity="0.6" />
        <path d="M220 380 h380 l-46 250 h-288 z" fill="#f9c7a3" stroke="#6b3a22" strokeWidth="10" strokeLinejoin="round" />
        {[270, 340, 410, 480, 550].map((x) => (
          <path key={x} d={`M${x} 390 L${x - 6 + (x - 410) * 0.06} 620`} stroke="#6b3a22" strokeWidth="6" opacity="0.35" />
        ))}
        <path d="M190 390 C 170 300, 260 230, 320 250 C 340 170, 480 160, 500 240 C 580 220, 660 300, 630 390 Z" fill={top} stroke="#6b3a22" strokeWidth="10" strokeLinejoin="round" className="pf-frost" />
        <circle cx="410" cy="200" r="34" fill="#e8344f" stroke="#6b3a22" strokeWidth="8" />
        {frosting && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={250 + i * 46} y={300 + ((i * 37) % 60)} width="22" height="9" rx="4.5" fill={["#fff", "#8fddbe", "#ffd23f", "#7b6ad6"][i % 4]} transform={`rotate(${(i * 47) % 180} ${261 + i * 46} ${304 + ((i * 37) % 60)})`} />)}
      </svg>
      <div style={{ position: "absolute", left: 50, right: 50, bottom: 80, display: "flex", justifyContent: "center", gap: 34 }}>
        {choices.map((f) => (
          <button
            key={f.id}
            data-bot={`frost-${f.id}`}
            aria-label=""
            onClick={() => onFrost(f.id)}
            className="pf-kidpart"
            style={{
              width: little ? 260 : 160,
              height: little ? 260 : 160,
              borderRadius: "50% 50% 46% 46%",
              background: `radial-gradient(60% 50% at 35% 30%, rgba(255,255,255,0.6), transparent 60%), ${f.color}`,
              boxShadow: frosting === f.id ? "0 0 0 10px #fff, 0 0 0 16px #6b3a22" : "inset 0 -12px 0 rgba(0,0,0,0.15), 0 16px 24px -12px rgba(107,58,34,0.6)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
