// Home is the deck: every game's cover, ordered by what needs you. Opening it from a game is the
// swap gesture; opening it from home is just home. One surface, two doors.
import type { Store } from "../../../harness/store";
import type { GameManifest } from "../../../world";
import { statusOf, type CoverKind, type CoverStatus } from "../covers";
import { allGames, seatsFor, instanceOf } from "../session";
import type { S } from "../state";
import { Bound, CoverArt, Tag } from "./Cover";
import { PeopleDots } from "./Spine";

const ORDER: Record<CoverKind, number> = { live: 0, turn: 1, soon: 2, ready: 3, paused: 4, done: 5, new: 6 };

export function Deck({ s, store, fromGame }: { s: S; store: Store<S>; fromGame: boolean }) {
  const games = allGames()
    .map((g) => ({ g, st: statusOf(g, s) }))
    .sort((a, b) => ORDER[a.st.kind] - ORDER[b.st.kind]);
  const hero = games[0];
  const strips = games.slice(1).filter((x) => x.st.kind === "turn" || x.st.kind === "soon" || x.st.kind === "ready").slice(0, 3);
  const shelf = games.slice(1).filter((x) => !strips.includes(x)).slice(0, 3);
  const open = (g: GameManifest) =>
    store.update((x) => (g.shape === "async" ? { ...x, phone: "duel-list" } : g.id === x.current ? { ...x, phone: "game" } : { ...x, phone: "seats", pick: g.id }));

  return (
    <div style={{ height: "100%", background: "var(--sp-paper)", padding: "44px 16px 0", animation: fromGame ? "sp-rise .42s cubic-bezier(.2,.8,.2,1) both" : undefined }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0, font: "700 30px/1 var(--sp-font)", color: "var(--sp-ink)", letterSpacing: "-0.02em" }}>Tonight</h1>
        <span style={{ font: "500 14px var(--sp-font)", color: "var(--sp-ink-soft)" }}>Fri 7:10 pm</span>
      </header>

      {hero && <HeroCover g={hero.g} s={s} store={store} onOpen={() => open(hero.g)} />}

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {strips.map(({ g, st }) => (
          <Bound key={g.id} g={g} bot={`cover-${g.id}`} onClick={() => open(g)} style={{ height: 80 }} label={`${g.name}: ${st.tag}`}>
            <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 132 }}>
              <CoverArt g={g} />
            </span>
            <span style={{ position: "absolute", left: 14, top: 10, right: 140 }}>
              <Tag status={st} />
              <span style={{ display: "block", margin: "6px 0 0 14px", font: "var(--g-display)", fontFamily: "var(--g-display)", fontWeight: 700, fontSize: 19, lineHeight: 1.05, color: "var(--g-on-ground)" }}>{g.name}</span>
              <span style={{ display: "block", margin: "2px 0 0 14px", font: "500 13px/1.25 var(--g-body)", color: "var(--g-on-ground)", }}>{st.line}</span>
            </span>
          </Bound>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "14px 0 8px" }}>
        <h2 style={{ margin: 0, font: "600 15px var(--sp-font)", color: "var(--sp-ink)" }}>On the shelf</h2>
        <span style={{ font: "500 14px var(--sp-font)", color: "var(--sp-ink-soft)" }}>All 7 games</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {shelf.map(({ g, st }) => (
          <ShelfCover key={g.id} g={g} st={st} onOpen={() => open(g)} />
        ))}
      </div>
    </div>
  );
}

export function ShelfCover({ g, st, onOpen }: { g: GameManifest; st: CoverStatus; onOpen: () => void }) {
  return (
    <Bound g={g} bot={`cover-${g.id}`} onClick={onOpen} style={{ height: 122, borderRadius: "0 10px 10px 0" }} label={`${g.name}: ${st.tag}`}>
      <span style={{ position: "absolute", inset: "0 0 40px 0" }}>
        <CoverArt g={g} />
      </span>
      <span style={{ position: "absolute", left: 14, bottom: 46 }}>
        <Tag status={st} style={{ fontSize: 12, padding: "5px 7px 5px 6px", whiteSpace: "normal", maxWidth: 96, lineHeight: 1.15 }} />
      </span>
      <span style={{ position: "absolute", left: 20, right: 6, bottom: 0, height: 40, display: "flex", alignItems: "center", fontFamily: "var(--g-display)", fontWeight: 700, fontSize: 15, lineHeight: 1.05, color: "var(--g-on-ground)" }}><span>{g.name}</span></span>
    </Bound>
  );
}

function HeroCover({ g, s, store, onOpen }: { g: GameManifest; s: S; store: Store<S>; onOpen: () => void }) {
  const st = statusOf(g, s);
  const seats = seatsFor(g, instanceOf(g.id));
  const back = () => (st.kind === "live" ? store.update((x) => ({ ...x, phone: "game", tvHeld: false })) : onOpen());
  return (
    <Bound g={g} style={{ height: 210 }}>
      <span style={{ position: "absolute", inset: "0 0 100px 0" }}>
        <CoverArt g={g} alt position="50% 40%" />
      </span>
      <span style={{ position: "absolute", left: 14, top: 12 }}>
        <Tag status={{ kind: st.kind, tag: st.kind === "live" ? `${st.tag} · Living room` : st.tag }} />
      </span>
      <div style={{ position: "absolute", left: 14, right: 0, bottom: 0, height: 100, padding: "8px 12px 10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--g-display)", fontSize: 26, lineHeight: 1, color: "var(--g-on-ground)" }}>{g.name}</div>
          <div style={{ font: "600 14px/1.25 var(--g-body)", color: "var(--g-on-ground)", marginTop: 4 }}>{st.line}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <PeopleDots ids={seats.map((x) => x.person.id)} size={20} ring={g.palette.ground} />
            <span style={{ font: "500 13px/1.2 var(--sp-font)", color: "var(--g-on-ground)" }}>{seats.map((x) => x.person.name).join(", ")}</span>
          </div>
        </div>
        {!s.firstRun && (
          <button data-bot="hero-back" onClick={back} className="sp-ogs-btn on-dark">
            <span>{g.shape === "async" ? "Play" : "Back in"}</span>
          </button>
        )}
      </div>
    </Bound>
  );
}

