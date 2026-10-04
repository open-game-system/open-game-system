// A kid's iPad: no words, ever. Between games it shows them sitting on the same couch the TV shows;
// when a grown-up seats them for a game they stand up in the spotlight; in the game it's their pads.
import { useState } from "react";
import { gameById } from "../../../world";
import { people, personOf, type S } from "../state";
import { gameVars } from "../ui";

type Mode = "asleep" | "room" | "called" | "playing" | "watching" | "waiting";

function modeOf(s: S, seat: string): Mode {
  if (s.cast === "dropped") return "waiting";
  if (s.cast !== "live") return "asleep";
  const v = s.view;
  if (v.kind === "detail") return s.pick.includes(seat) ? "called" : "room";
  if (v.kind === "game") return s.crew.includes(seat) ? "playing" : "watching";
  return "room";
}

function KidCouch({ seat, lit, onPoke, poked }: { seat: string; lit: boolean; onPoke: () => void; poked: number }) {
  return (
    <div className={`cr-kcouch ${lit ? "" : "is-dim"}`}>
      <div className="cr-kcouch-back" />
      <div className="cr-kcouch-row">
        {people.map((p) =>
          p.id === seat ? (
            <button key={p.id} type="button" className="cr-kme" aria-label="me" data-bot="kid-me" onClick={onPoke}>
              <img key={poked} className={poked > 0 ? "is-wiggle" : ""} src={p.sticker} alt="" />
            </button>
          ) : (
            <img key={p.id} className="cr-kother" src={p.sticker} alt="" />
          ),
        )}
      </div>
      <div className="cr-kcouch-seat" />
    </div>
  );
}

function WallTv({ art, waiting }: { art?: string; waiting?: boolean }) {
  return (
    <div className="cr-ktv">
      {art ? <img src={art} alt="" /> : <div className={waiting ? "cr-ktv-wait" : "cr-ktv-glow"} />}
    </div>
  );
}

function Pads({ seat, gameId }: { seat: string; gameId: string }) {
  const g = gameById(gameId);
  const me = personOf(seat);
  const [hit, setHit] = useState<{ pad: number; n: number }>({ pad: -1, n: 0 });
  const pads = me.band === "little" ? [0] : [0, 1, 2];
  return (
    <div className={`cr-kpads ${me.band === "little" ? "is-little" : ""}`} style={gameVars(g)}>
      <img className="cr-kpads-art" src={g.art.tv} alt="" />
      <div className="cr-kpads-veil" />
      <img className="cr-kpads-me" src={me.sticker} alt="" />
      <div className="cr-kpads-row">
        {pads.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`pad ${i + 1}`}
            data-bot={`pad-${i}`}
            className={`cr-kpad is-${i} ${hit.pad === i ? "is-hit" : ""}`}
            onClick={() => setHit((h) => ({ pad: i, n: h.n + 1 }))}
          >
            <span key={hit.pad === i ? hit.n : 0} className="cr-kpad-shape" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Kid({ s, seat }: { s: S; seat: string }) {
  const [poked, setPoked] = useState(0);
  const mode = modeOf(s, seat);
  const v = s.view;
  if (mode === "playing" && v.kind === "game") return <Pads seat={seat} gameId={v.gameId} />;
  const me = personOf(seat);
  const pending = v.kind === "detail" ? gameById(v.gameId) : undefined;
  const tvArt = mode === "watching" && v.kind === "game" ? gameById(v.gameId).art.tv : undefined;
  return (
    <div className={`cr-kid is-${mode}`}>
      <div className="cr-kid-wall" />
      {mode === "asleep" ? <span className="cr-kid-moon" /> : null}
      <WallTv art={tvArt} waiting={mode === "waiting"} />
      {mode === "called" && pending ? (
        <div className="cr-called" style={gameVars(pending)}>
          <div className="cr-called-art">
            <img src={pending.art.tv} alt="" />
          </div>
          <img className="cr-called-me" src={me.sticker} alt="" />
          <span className="cr-called-ring" />
        </div>
      ) : null}
      <KidCouch seat={seat} lit={mode !== "asleep"} poked={poked} onPoke={() => setPoked((n) => n + 1)} />
    </div>
  );
}
