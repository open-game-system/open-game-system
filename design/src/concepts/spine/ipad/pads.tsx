// Stand-ins for the games' OWN kid controllers (their web content on the iPad): no words, huge
// targets, nothing that leaves the game. Drawn in each game's palette and props.
import { useState, type CSSProperties, type ReactNode } from "react";
import { gameById, type GameManifest } from "../../../world";
import { Cupcake, Frosting, Ring, Sprinkles, Star, Strawberry, Triangle } from "../games/props";
import { skinOf } from "../skin";

function Pad({ bot, children, size, bg, glow, style }: { bot: string; children: ReactNode; size: number; bg: string; glow?: boolean; style?: CSSProperties }) {
  const [n, setN] = useState(0);
  return (
    <button
      data-bot={bot}
      className="sp-pad"
      aria-label=""
      onClick={() => setN((x) => x + 1)}
      style={{
        width: size, height: size, borderRadius: size * 0.22, background: bg, display: "grid", placeItems: "center", position: "relative",
        boxShadow: "0 14px 0 rgba(0,0,0,.25)", animation: glow ? "sp-glow 1.2s ease-out infinite" : n ? "sp-wiggle .35s" : undefined, ...style,
      }}
      key={n}
    >
      {children}
    </button>
  );
}

export function FixerPad({ little }: { little?: boolean }) {
  const g = gameById("rocket-crew");
  return (
    <Ground g={g} art={g.art.extra?.launch ?? g.art.tv}>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, paddingTop: 70 }}>
        <Star size={84} /> <Star size={84} /> <Star size={84} fill="rgba(255,246,224,.12)" stroke="rgba(255,246,224,.7)" />
      </div>
      <div style={{ width: 430, height: 430, margin: "40px auto 0", borderRadius: "50%", overflow: "hidden", boxShadow: `0 0 0 18px #e9e1f5, 0 0 0 26px ${g.palette.accent}` }}>
        <img src={g.art.alt ?? g.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "60% 60%" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 140, display: "flex", justifyContent: "center", gap: 34 }}>
        {little ? (
          <Pad bot="kid-ring" size={300} bg={g.palette.accent} glow>
            <Ring size={190} color="#fff6e0" />
          </Pad>
        ) : (
          <>
            <Pad bot="kid-star" size={220} bg={g.palette.accent2} glow>
              <Star size={150} fill="#fff6e0" />
            </Pad>
            <Pad bot="kid-ring" size={220} bg={g.palette.accent}>
              <Ring size={140} color="#fff6e0" />
            </Pad>
            <Pad bot="kid-tri" size={220} bg="#5b46c9">
              <Triangle size={130} color="#fff6e0" />
            </Pad>
          </>
        )}
      </div>
    </Ground>
  );
}

export function BakerPad({ compact }: { compact?: boolean }) {
  const g = gameById("bake-shop");
  const bear = g.art.extra?.bear;
  const s = compact ? 0.62 : 1;
  return (
    <Ground g={g}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingTop: 60 * s }}>
        {bear && <img src={bear} alt="" style={{ height: 300 * s, objectFit: "contain" }} />}
        <div style={{ position: "relative", width: 260 * s, height: 220 * s, borderRadius: "50%", background: "#fffaf0", boxShadow: "0 6px 0 #ecd6ad", display: "grid", placeItems: "center", marginBottom: 150 * s }}>
          <Cupcake size={190 * s} berry sprinkles />
          <span style={{ position: "absolute", left: -18 * s, bottom: -26 * s, width: 34 * s, height: 34 * s, borderRadius: "50%", background: "#fffaf0" }} />
        </div>
      </div>
      <div style={{ display: "grid", placeItems: compact ? "center end" : "center", padding: compact ? "0 110px 0 0" : 0, marginTop: compact ? -150 : -40 }}>
        <Cupcake size={compact ? 190 : 300} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: compact ? 30 : 140, display: "flex", justifyContent: "center", gap: 30 }}>
        <Pad bot="kid-berry" size={220 * (compact ? 0.82 : 1)} bg="#fffaf0" glow style={{ "--glow": "rgba(244,106,142,.8)" }}>
          <Strawberry size={150 * (compact ? 0.82 : 1)} />
        </Pad>
        <Pad bot="kid-sprinkles" size={220 * (compact ? 0.82 : 1)} bg="#fffaf0">
          <Sprinkles size={150 * (compact ? 0.82 : 1)} />
        </Pad>
        <Pad bot="kid-frosting" size={220 * (compact ? 0.82 : 1)} bg="#fffaf0">
          <Frosting size={150 * (compact ? 0.82 : 1)} />
        </Pad>
      </div>
    </Ground>
  );
}

export function HelperPad({ compact }: { compact?: boolean }) {
  const g = gameById("bake-shop");
  const size = compact ? 300 : 520;
  return (
    <Ground g={g} tint={g.palette.accent2}>
      <div style={{ display: "grid", placeItems: "center", paddingTop: compact ? 30 : 110 }}>
        {!compact && <Cupcake size={260} berry />}
        <Pad bot="kid-shake" size={size} bg={g.palette.accent} glow style={{ borderRadius: "50%", marginTop: compact ? 0 : 30, "--glow": "rgba(255,255,255,.8)" }}>
          <Sprinkles size={size * 0.6} />
        </Pad>
      </div>
    </Ground>
  );
}

/** Any game without a kid stand-in: its art and one giant accent button. */
export function GenericPad({ g }: { g: GameManifest }) {
  return (
    <Ground g={g} art={g.art.tv}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 160, display: "grid", placeItems: "center" }}>
        <Pad bot="kid-go" size={360} bg={g.palette.accent} glow style={{ borderRadius: "50%" }}>
          <Star size={200} fill={g.palette.ink} />
        </Pad>
      </div>
    </Ground>
  );
}

function Ground({ g, children, art, tint }: { g: GameManifest; children: ReactNode; art?: string; tint?: string }) {
  const k = skinOf(g);
  return (
    <div style={{ position: "absolute", inset: 0, background: tint ? `radial-gradient(circle at 50% 62%, ${tint}, ${k.ground} 62%)` : k.ground, overflow: "hidden", animation: "sp-fade .4s both" }}>
      {art && <img src={art} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.32 }} />}
      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  );
}
