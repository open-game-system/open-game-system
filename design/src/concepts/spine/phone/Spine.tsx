// The phone's spine: household, the deck tab (the swap gesture), the cast, the turn inbox.
// It never changes with the game. Everything OGS has to say is said here or on its ledge.
import type { CSSProperties } from "react";
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import { ChevronUp, DeckGlyph, TurnGlyph, TvGlyph } from "../glyphs";
import { game, TONIGHT } from "../session";
import type { S } from "../state";
import { yourTurnCount } from "./turns";

export function PeopleDots({ ids, size = 26, ring = "var(--sp-ink)" }: { ids: string[]; size?: number; ring?: string }) {
  return (
    <span style={{ display: "inline-flex" }} aria-hidden>
      {ids.map((id, i) => {
        const p = HOME.people.find((x) => x.id === id);
        if (!p) return null;
        return (
          <span
            key={id}
            style={{
              width: size, height: size, borderRadius: "50%", background: p.color, marginLeft: i ? -size * 0.32 : 0,
              boxShadow: `0 0 0 2px ${ring}`, overflow: "hidden", display: "inline-block", position: "relative",
            }}
          >
            {p.portrait && <img src={p.portrait} alt="" style={{ width: "120%", height: "120%", objectFit: "cover", objectPosition: "50% 18%", margin: "-4% 0 0 -10%" }} />}
          </span>
        );
      })}
    </span>
  );
}

export function Spine({ s, store }: { s: S; store: Store<S> }) {
  const inGame = s.phone === "game" || s.phone === "seats";
  const shown = s.target ?? s.current;
  const g = game(shown);
  if (!s.cast) return <IdleSpine s={s} store={store} turns={yourTurnCount(s)} />;
  const turns = yourTurnCount(s);
  const toggleDeck = () => store.update((x) => ({ ...x, phone: x.phone === "game" ? "deck" : "game" }));

  if (s.firstRun) {
    return (
      <nav className="sp-spine sp-stitch-top" style={spineStyle}>
        <div style={row}>
          <span style={{ ...slot, color: "var(--sp-dim)", font: "600 14px var(--sp-font)" }}>Just you</span>
          <span style={{ ...slot, flex: 1, justifyContent: "center", color: "var(--sp-bone)", font: "600 15px var(--sp-font)" }}>Library</span>
          <span style={{ ...slot, color: "var(--sp-dim)", font: "600 14px var(--sp-font)", gap: 8 }}>
            <TvGlyph size={20} /> No TV yet
          </span>
        </div>
        <HomeBar />
      </nav>
    );
  }

  return (
    <nav className="sp-spine sp-stitch-top" style={spineStyle} aria-label="OGS">
      <div style={row}>
        <button data-bot="spine-family" style={{ ...slot, gap: 8, minWidth: 82 }} aria-label="The Mumms, 3 home tonight">
          <PeopleDots ids={TONIGHT} size={24} />
          <span style={{ font: "600 14px/1.1 var(--sp-font)", color: "var(--sp-bone)", textAlign: "left" }}>
            3<br />
            <span style={{ color: "var(--sp-dim)", fontWeight: 500 }}>home</span>
          </span>
        </button>

        <button
          data-bot="spine-deck"
          onClick={toggleDeck}
          style={{ ...slot, flex: 1, gap: 10, justifyContent: "center", minWidth: 0 }}
          aria-label={inGame ? "Open the deck to swap games" : `Back to ${g.name}`}
        >
          <span
            style={{
              width: 34, height: 44, borderRadius: 3, flex: "none", transform: "rotate(-5deg)",
              background: g.art.tv ? `center/cover url(${g.art.tv})` : g.palette.ground,
              boxShadow: `0 0 0 2px ${g.palette.accent}, 0 4px 10px rgba(0,0,0,.5)`,
            }}
          />
          <span style={{ textAlign: "left", minWidth: 0 }}>
            <span style={{ display: "block", font: "600 15px/1.15 var(--sp-font)", color: "var(--sp-bone)", whiteSpace: "nowrap" }}>{g.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, font: "500 13px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>
              {inGame ? (
                <>
                  <ChevronUp size={12} /> Games
                </>
              ) : (
                "Back in"
              )}
            </span>
          </span>
        </button>

        <button data-bot="spine-cast" style={{ ...slot, width: 52, justifyContent: "center", position: "relative", color: "var(--sp-bone)" }} aria-label="Casting to the living room TV">
          <TvGlyph size={24} />
          <span className="sp-bead" style={{ position: "absolute", top: 13, right: 11 }} />
        </button>

        <button
          data-bot="spine-turns"
          onClick={() => store.update((x) => ({ ...x, phone: "duel-list" }))}
          style={{ ...slot, width: 56, justifyContent: "center", position: "relative", color: "var(--sp-bone)" }}
          aria-label={`${turns} of your turns waiting`}
        >
          <TurnGlyph size={24} />
          {turns > 0 && (
            <span style={{ position: "absolute", top: 8, right: 6, minWidth: 26, height: 26, borderRadius: 13, background: "var(--sp-bone)", color: "var(--sp-ink)", font: "700 14px/26px var(--sp-font)", textAlign: "center", padding: "0 5px" }}>
              <span>{turns}</span>
            </span>
          )}
        </button>
      </div>
      <HomeBar />
    </nav>
  );
}

/** No couch session: the deck tab opens the deck; the cast slot offers the TV. */
function IdleSpine({ s, store, turns }: { s: S; store: Store<S>; turns: number }) {
  const onDeck = s.phone === "deck" || s.phone === "home";
  return (
    <nav className="sp-spine sp-stitch-top" style={spineStyle} aria-label="OGS">
      <div style={row}>
        <button data-bot="spine-family" style={{ ...slot, gap: 8, minWidth: 82 }} aria-label="The Mumms">
          <PeopleDots ids={HOME.people.map((p) => p.id)} size={24} />
        </button>
        <button data-bot="spine-deck" onClick={() => store.update((x) => ({ ...x, phone: "deck" }))} style={{ ...slot, flex: 1, gap: 10, justifyContent: "center", color: onDeck ? "var(--sp-bone)" : "var(--sp-dim)" }}>
          <DeckGlyph size={24} />
          <span style={{ font: "600 15px var(--sp-font)" }}>All games</span>
        </button>
        <button data-bot="spine-cast" style={{ ...slot, width: 52, justifyContent: "center", color: "var(--sp-dim)" }} aria-label="Cast to a TV">
          <TvGlyph size={24} />
        </button>
        <button data-bot="spine-turns" onClick={() => store.update((x) => ({ ...x, phone: "duel-list" }))} style={{ ...slot, width: 56, justifyContent: "center", position: "relative", color: "var(--sp-bone)" }} aria-label={`${turns} of your turns waiting`}>
          <TurnGlyph size={24} />
          {turns > 0 && <span style={badge}><span>{turns}</span></span>}
        </button>
      </div>
      <HomeBar />
    </nav>
  );
}

const badge: CSSProperties = { position: "absolute", top: 8, right: 6, minWidth: 26, height: 26, borderRadius: 13, background: "var(--sp-bone)", color: "var(--sp-ink)", font: "700 14px/26px var(--sp-font)", textAlign: "center", padding: "0 5px" };

const HomeBar = () => <div style={{ height: 22, display: "flex", justifyContent: "center", alignItems: "center" }}><span style={{ width: 134, height: 5, borderRadius: 3, background: "var(--sp-bone)", opacity: 0.85 }} /></div>;

const spineStyle: CSSProperties = { background: "var(--sp-ink)", paddingTop: 12, flex: "none", position: "relative", zIndex: 5 };
const row: CSSProperties = { display: "flex", alignItems: "center", height: 60, padding: "0 10px", gap: 4 };
const slot: CSSProperties = { display: "flex", alignItems: "center", height: 56, padding: "0 6px", borderRadius: 10 };
