// A kid's iPad, paired once by name. It follows whatever the TV runs; no words, nothing to derail.
import { useState } from "react";
import type { Store } from "../../harness/store";
import { useStore } from "../../harness/store";
import { DEFAULT_PAD, KID_PADS, type Glyph } from "./fixtures";
import { game, personOf, type S } from "./state";
import { GameArt, GlyphShape, Icon, Sticker } from "./ui";

export function KidSurface({ store, seat }: { store: Store<S>; seat: string }) {
  const s = useStore(store);
  const me = personOf(seat);
  const [wiggle, setWiggle] = useState(0);
  const v = s.view;
  const castOn = s.cast === "on";
  const lostGame = (s.cast === "dropped" || s.cast === "recasting") && v.kind === "game" ? v.gameId : null;
  const holding = s.cast === "dropped" || s.cast === "recasting" || s.cast === "connecting";
  const inGame = castOn && v.kind === "game";
  const playing = inGame && s.tonight.includes(seat);
  const picked = castOn && v.kind === "who" && s.picking.includes(seat);
  const battery = me.id === "ava";
  const poke = () => setWiggle((n) => n + 1);

  if (playing && v.kind === "game") return <Pad seat={seat} gameId={v.gameId} starting={v.phase === "starting"} battery={battery} />;

  const susp = castOn && v.kind === "home" && s.suspended && s.tonight.includes(seat) ? s.suspended : null;
  const pickedGame = picked && v.kind === "who" && v.gameId ? v.gameId : null;
  const watchGame = inGame && v.kind === "game" ? v.gameId : null;
  const showGame = susp ?? lostGame ?? pickedGame ?? watchGame;
  const focusId = s.order[s.focus.games] ?? "rocket-crew";

  return (
    <div className={`sw-kid ${s.cast === "off" || s.cast === "picking" || s.cast === "none-found" ? "is-off" : ""} ${picked ? "is-picked" : ""}`} style={{ "--pc": me.color }}>
      {battery && <Battery />}
      {showGame ? (
        <div className={`sw-kid__card ${susp || lostGame ? "is-susp" : ""} ${watchGame ? "is-watch" : ""}`}>
          <GameArt g={game(showGame)} />
          {(susp || lostGame) && <span className="sw-kid__pause"><Icon name="pause" size={110} color="#fffaf0" /></span>}
          {pickedGame && <span className="sw-kid__check"><Icon name="check" size={90} color="#fffaf0" /></span>}
          {watchGame && <span className="sw-kid__tvbadge"><Icon name="tv" size={70} color="#fffaf0" /></span>}
        </div>
      ) : castOn || s.cast === "connecting" ? (
        <div className="sw-kid__tv" aria-hidden="true">
          <div className="sw-kid__tvscreen">
            {castOn && s.order.slice(0, 4).map((id) => (
              <span key={id} className={`sw-kid__mini ${id === focusId ? "is-on" : ""}`}><GameArt g={game(id)} /></span>
            ))}
          </div>
        </div>
      ) : (
        <div className="sw-kid__moon"><Icon name="moon" size={120} color="#c9c4b8" /></div>
      )}
      <button data-bot={`kid-${seat}`} aria-label="Me" key={wiggle} className={`sw-kid__me ${wiggle ? "is-wiggle" : ""}`} onClick={poke}>
        <span className="sw-kid__disc">
          <Sticker pid={seat} size={300} />
        </span>
        {picked && <span className="sw-kid__burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg)` }} />)}</span>}
        {holding && <span className="sw-kid__loop" aria-hidden="true" />}
      </button>
    </div>
  );
}

function Battery() {
  return (
    <span className="sw-kid__batt" aria-hidden="true">
      <span />
    </span>
  );
}

function Pad({ seat, gameId, starting, battery }: { seat: string; gameId: string; starting: boolean; battery: boolean }) {
  const g = game(gameId);
  const pad = KID_PADS[gameId] ?? DEFAULT_PAD;
  const little = personOf(seat).band === "little";
  const [hit, setHit] = useState<number | null>(null);
  const glyphs: Glyph[] = little ? [pad.little] : pad.kid;
  const colors = [g.palette.accent, g.palette.accent2, "#3fa7ff"];
  return (
    <div className={`sw-pad ${starting ? "is-starting" : ""}`} style={{ "--gg": g.palette.ground }}>
      <img className="sw-pad__bg" src={g.art.tv} alt="" />
      {battery && <Battery />}
      <span className="sw-pad__me"><Sticker pid={seat} size={130} /></span>
      <div className={`sw-pad__btns ${little ? "is-one" : ""}`}>
        {glyphs.map((gl, i) => (
          <button
            key={`${gl}${i}`}
            data-bot={`pad-${seat}-${i}`}
            aria-label={gl}
            className={`sw-pad__btn ${hit === i ? "is-hit" : ""}`}
            style={{ "--bc": colors[i % colors.length] ?? g.palette.accent }}
            onPointerDown={() => setHit(i)}
            onPointerUp={() => setHit(null)}
          >
            <GlyphShape name={gl} color={colors[i % colors.length] ?? g.palette.accent} size={little ? 300 : 190} />
          </button>
        ))}
      </div>
    </div>
  );
}
