// Stand-ins for each game's OWN grown-up web view (what its startUrl would render inside the
// spine). These are the games' code, not the app's: the app only frames them. Any game without a
// stand-in gets a generic frame from its manifest.
import type { ReactNode } from "react";
import { gameById, type GameManifest } from "../../../world";
import { skinOf, skinVars } from "../skin";
import { Star, Strawberry, Sprinkles } from "./props";

function Frame({ g, children }: { g: GameManifest; children: ReactNode }) {
  const k = skinOf(g);
  return (
    <div style={{ ...skinVars(k), height: "100%", background: k.ground, color: k.onGround, fontFamily: k.body, position: "relative", overflow: "hidden", animation: "sp-fade .4s both" }}>
      {children}
    </div>
  );
}

export function RocketCaptain() {
  const g = gameById("rocket-crew");
  return (
    <Frame g={g}>
      <img src={g.art.tv} alt="" style={{ position: "absolute", inset: "0 0 auto 0", width: "100%", height: 300, objectFit: "cover", objectPosition: "60% 45%", opacity: 0.55 }} />
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 300, background: `linear-gradient(to bottom, transparent 40%, ${g.palette.ground})` }} />
      <div style={{ position: "relative", padding: "58px 20px 0" }}>
        <div style={{ font: "400 16px 'Lilita One'", letterSpacing: "0.08em", color: g.palette.accent2 }}>MISSION 6 · CAPTAIN</div>
        <div style={{ font: "400 38px/1 'Lilita One'", marginTop: 4 }}>To Chilly Island</div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <Star size={34} /> <Star size={34} /> <Star size={34} fill="none" stroke="rgba(255,246,224,.6)" />
        </div>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 250, background: g.palette.ink, color: g.palette.ground, borderRadius: 22, padding: "16px 18px", boxShadow: `0 6px 0 ${g.palette.accent}` }}>
        <div style={{ font: "700 14px 'Baloo 2'", letterSpacing: "0.04em", color: "#7a2a55" }}>CALL OUT TO YOUR CREW</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <Star size={52} />
          <div style={{ font: "800 23px/1.1 'Baloo 2'" }}>“Juneau, fix the gold star!”</div>
        </div>
        <div style={{ font: "600 16px/1.3 'Baloo 2'", marginTop: 8 }}>Ava’s on the pink ring. Asteroids in 20 seconds.</div>
      </div>
      <Route color={g.palette.accent2} ink={g.palette.ink} />
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 22, display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 10, alignItems: "end" }}>
        <button data-bot="rc-left" style={{ height: 96, borderRadius: 22, background: "rgba(255,246,224,.12)", font: "400 22px 'Lilita One'", color: g.palette.ink }}><span>Left</span></button>
        <button data-bot="rc-boost" style={{ height: 132, borderRadius: 66, background: g.palette.accent, color: g.palette.ground, font: "400 28px 'Lilita One'", boxShadow: `0 8px 0 #b8326f` }}><span>Boost</span></button>
        <button data-bot="rc-right" style={{ height: 96, borderRadius: 22, background: "rgba(255,246,224,.12)", font: "400 22px 'Lilita One'", color: g.palette.ink }}><span>Right</span></button>
      </div>
    </Frame>
  );
}

/** Route to Chilly Island: planets passed, the rocket's dot, the island ahead. */
function Route({ color, ink }: { color: string; ink: string }) {
  const stops = [40, 105, 170, 235, 300];
  return (
    <svg width="358" height="92" viewBox="0 0 358 92" style={{ position: "absolute", left: 16, top: 470 }} aria-hidden>
      <path d="M20 60 C 90 10, 150 90, 220 40 S 320 30, 340 50" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      {stops.map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 62 : 34} r={i < 3 ? 9 : 7} fill={i < 3 ? color : "none"} stroke={ink} strokeOpacity={i < 3 ? 0 : 0.5} strokeWidth="2.5" />
      ))}
      <circle cx="340" cy="50" r="16" fill="#9fe3ff" stroke={ink} strokeWidth="3" />
      <path d="M190 52 l14 -6 -14 -6 4 6z" fill={ink} />
    </svg>
  );
}

export function BakeReader({ reader }: { reader: string }) {
  const g = gameById("bake-shop");
  const bear = g.art.extra?.bear;
  return (
    <Frame g={g}>
      <div style={{ padding: "56px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ font: "800 30px/1 'Baloo 2'", color: g.palette.ink }}>Day 4</div>
        <div style={{ font: "700 16px 'Baloo 2'", color: g.palette.ink }}>Order 4 of 5 · {reader} reads</div>
      </div>
      <div style={{ margin: "14px 16px 0", background: "#fffaf0", borderRadius: 26, padding: 16, display: "flex", gap: 12, boxShadow: "0 3px 0 #ecd6ad" }}>
        {bear && <img src={bear} alt="" style={{ width: 96, height: 120, objectFit: "contain", flex: "none" }} />}
        <div>
          <div style={{ font: "700 14px 'Baloo 2'", color: "#8a4b2c" }}>READ ALOUD · MRS. BEAR</div>
          <div style={{ font: "800 24px/1.12 'Baloo 2'", color: g.palette.ink, marginTop: 2 }}>“One strawberry cupcake, sprinkles on top, please!”</div>
        </div>
      </div>
      <div style={{ margin: "16px 16px 0", display: "grid", gap: 8 }}>
        {[
          { who: "Juneau", what: "Strawberry on top", icon: <Strawberry size={40} />, done: false },
          { who: "Ava", what: "Sprinkles", icon: <Sprinkles size={40} />, done: false },
        ].map((r) => (
          <div key={r.who} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fffaf0", borderRadius: 18, padding: "8px 14px" }}>
            {r.icon}
            <div style={{ flex: 1, font: "700 18px 'Baloo 2'", color: g.palette.ink }}>{r.what}</div>
            <div style={{ font: "600 15px 'Baloo 2'", color: g.palette.ink }}>{r.who}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 22 }}>
        <button data-bot="bs-bell" style={{ width: "100%", height: 64, borderRadius: 32, background: g.palette.accent, color: "#16130f", font: "800 22px 'Baloo 2'", boxShadow: "0 6px 0 #c94a6c" }}><span>Ring the bell</span></button>
      </div>
    </Frame>
  );
}

/** Any other game: its art and name, framed. */
export function GenericGame({ g }: { g: GameManifest }) {
  const k = skinOf(g);
  return (
    <Frame g={g}>
      {g.art.tv && <img src={g.art.alt ?? g.art.tv} alt="" style={{ width: "100%", height: 360, objectFit: "cover" }} />}
      <div style={{ padding: 20, fontFamily: k.display, fontSize: 34, color: k.onGround }}>{g.name}</div>
    </Frame>
  );
}
