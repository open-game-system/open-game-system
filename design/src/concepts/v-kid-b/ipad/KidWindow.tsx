// Paired and waiting, as a window into the TV. The iPad shows a slice of the very same console home
// that is on the TV: the focused game's world fills the glass, the couch shelf runs across the
// middle (same tiles, same order, same focus), and the family's stickers stand on the window sill
// at the bottom, the child's own character in the middle. Poke a tile and your sticker lands on it
// here and on the TV (a wish the grown-ups can see); poke a sticker and it hops on both screens.
// No words. Nothing here changes what plays: a poke is only ever a ripple and a wish.
import { useRef, type PointerEvent } from "react";
import type { Store } from "../../../harness/store";
import { person, type Person } from "../../../world";
import { hereTonight, pokeThrough, type S } from "../state";
import { TvArt } from "../tv/TvArt";
import { Bursts, useBursts } from "./juice";
import { KidChar } from "./KidChar";
import { homeShelf } from "./window";

export function KidWindow({ s, store, who }: { s: S; store: Store<S>; who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const { games, focus } = homeShelf(s);
  const poke = (target: string, isGame: boolean) => (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fire(e, host.current, isGame ? "star" : "heart", [who.color, "#fff6e0", "#ffd23f"], true);
    store.update((x) => pokeThrough(x, who.id, target, isGame));
  };
  const others = hereTonight(s).filter((p) => p.id !== who.id);
  return (
    <div ref={host} className="kw" style={{ color: who.color }} onPointerDown={(e) => fire(e, host.current, "spark", ["#fff6e0", who.color])}>
      <div className="kw__world" key={focus ?? "none"} aria-hidden>
        {focus && <TvArt gameId={focus} />}
      </div>
      <div className="kw__scrim" aria-hidden />
      <Shelf s={s} games={games} focus={focus} onPoke={(g) => poke(g, true)} />
      <Sill who={who} others={others} s={s} onPoke={(id) => poke(id, false)} />
      <span className="kw__glass" aria-hidden />
      <Bursts bursts={bursts} />
    </div>
  );
}

/** The TV's couch shelf, through the glass: big art-only tiles, each child's wish sticker on its tile. */
export function Shelf({ s, games, focus, onPoke, className = "" }: { s: S; games: string[]; focus: string | null; onPoke: (gameId: string) => (e: PointerEvent<HTMLButtonElement>) => void; className?: string }) {
  return (
    <div className={`kw-shelf ${className}`}>
      {games.map((g, i) => {
        const wishers = Object.entries(s.wish).filter(([, w]) => w === g).map(([id]) => person(id));
        const poked = s.poke && s.poke.target === g ? s.poke.n : 0;
        return (
          <button
            key={g}
            className={`kw-tile ${g === focus ? "is-focus" : ""}`}
            style={{ animationDelay: `${i * 70}ms` }}
            aria-label={g}
            data-bot={`kid-tile-${g}`}
            onPointerDown={onPoke(g)}
          >
            <span key={poked} className={`kw-tile__art ${poked ? "is-poked" : ""}`}>
              <TvArt gameId={g} />
            </span>
            <span className="kw-tile__wish">
              {wishers.map((p) => (
                <img key={`${p.id}-${poked}`} src={p.sticker} alt="" style={{ borderColor: p.color }} draggable={false} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The window sill: the family here tonight as their stickers, this child's own character in the middle. */
function Sill({ who, others, s, onPoke }: { who: Person; others: Person[]; s: S; onPoke: (id: string) => (e: PointerEvent<HTMLButtonElement>) => void }) {
  const left = others.filter((_, i) => i % 2 === 0);
  const right = others.filter((_, i) => i % 2 === 1);
  const side = (p: Person) => {
    const n = s.poke && s.poke.target === p.id ? s.poke.n : 0;
    return (
      <button key={p.id} className="kw-sticker" aria-label={p.name} data-bot={`kid-sticker-${p.id}`} onPointerDown={onPoke(p.id)} style={{ color: p.color }}>
        <span className="kw-sticker__pad" />
        <img key={n} className={n ? "is-hop" : ""} src={p.sticker} alt="" draggable={false} />
      </button>
    );
  };
  return (
    <div className="kw-sill">
      <span className="kw-sill__ledge" aria-hidden />
      <div className="kw-sill__side kw-sill__side--l">{left.map(side)}</div>
      <KidChar who={who} size={250} className="kw-sill__me" onPoke={onPoke(who.id)} />
      <div className="kw-sill__side kw-sill__side--r">{right.map(side)}</div>
    </div>
  );
}
