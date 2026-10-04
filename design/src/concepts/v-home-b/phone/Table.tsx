// "Family table": home is led by who's here tonight. The family's stickers sit in chairs around a
// drawn table; the games are things on it (the one on the TV glows at the head, the rest lie on the
// table, one tap each); a game night is a place set for another home; turns are cards in your hand
// (Hand.tsx). The people are the organising idea, the games stay one tap away.
import type { Store } from "../../../harness/store";
import { HOME, gameById, type Person } from "../../../world";
import { couchShelf } from "../activities";
import { beginNewNight, household, nightStatus, openNight, US, type Night } from "../nights";
import { castAndPlay, hereTonight, night, openStartNew, pickActivity, pointIn, saveOf, type S } from "../state";
import { GameArt } from "../ui/GameArt";
import { Gamepad, Plus, TvIcon } from "../ui/Icons";
import { Crest, Sticker } from "../ui/Sticker";

const openWho = (x: S): S => ({ ...x, who: true });

/** One chair at the table: the person's sticker on it, their name, and (if out) "out tonight". */
function Seat({ p, here, store, bot }: { p: Person; here: boolean; store: Store<S>; bot?: string }) {
  return (
    <button className={`ft-seat ${here ? "" : "is-out"}`} data-bot={bot} aria-label={`${p.name}${here ? ", here tonight" : ", out tonight"}. Change who's here`} onClick={() => store.update(openWho)}>
      <span className="ft-seat__chair" aria-hidden />
      <span className="ft-seat__who">
        <Sticker person={p} size={here ? 54 : 40} dim={!here} />
      </span>
      <b>{p.name}</b>
      {!here && <span className="ft-seat__note">Out tonight</span>}
    </button>
  );
}

/** A place set for another home: their crests on the chair, the night's game on the plate, a place card. */
function PlaceSet({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const guests = n.homes.filter((h) => h.householdId !== US && h.reply !== "declined");
  const status = nightStatus(n, s.onTv);
  const names = guests.map((h) => h.name.replace(/^The /, "")).join(" & ");
  return (
    <button className={`ft-place ft-place--${status.kind}`} data-bot={`night-${n.id}`} aria-label={`${gameById(n.gameId).name} with ${names}. ${status.label}`} onClick={() => store.update((x) => night(x, (ns) => openNight(ns, n.id)))}>
      <span className="ft-place__guests" aria-hidden>
        {guests.map((h) => (
          <Crest key={h.householdId} household={household(h.householdId)} size={34} shared dim={!h.back && n.status === "live"} />
        ))}
      </span>
      <span className="ft-place__plate" aria-hidden>
        <GameArt gameId={n.gameId} />
      </span>
      <span className="ft-place__card">
        <b>{status.label}</b>
        <span>{gameById(n.gameId).name}</span>
      </span>
    </button>
  );
}

/** The game the TV is on (or showing large on its home), glowing at the head of the table. */
function TvGame({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const game = gameById(focusId);
  const canPlay = game.shape === "couch";
  const save = !playing && !s.fresh[focusId] ? saveOf(focusId) : null;
  const liveNight = s.nights.list.find((n) => n.status === "live" && n.gameId === playing);
  const where = playing ? "On the TV now" : s.cast === "off" ? "Next on the TV" : "Up on the TV";
  const line = playing ? (liveNight ? `Turn ${liveNight.turn}` : pointIn(s, focusId)) : save ? `Saved at ${save.point.toLowerCase()}` : pointIn(s, focusId);
  const go = () =>
    store.update((x) => (x.onTv ? { ...x, phone: "controller" } : !canPlay ? x : x.cast === "off" ? castAndPlay(x, x.tvFocus) : { ...x, onTv: x.tvFocus, phone: "controller" }));
  return (
    <div className={`ft-tv ${playing ? "is-live" : ""}`}>
      <div className="ft-tv__art" key={focusId}>
        <GameArt gameId={focusId} />
        <span className="ft-tv__where">
          {playing ? <span className="cx-live-dot" aria-hidden /> : <TvIcon size={14} />}
          {where}
        </span>
      </div>
      <div className="ft-tv__text">
        <div className="ft-tv__name">{game.name}</div>
        <div className="ft-tv__line">{line}</div>
        {liveNight && (
          <span className="ft-tv__guests">
            {liveNight.homes
              .filter((h) => h.householdId !== US && h.reply !== "declined")
              .map((h) => (
                <Crest key={h.householdId} household={household(h.householdId)} size={32} shared />
              ))}
          </span>
        )}
      </div>
      {(playing || canPlay) && (
        <div className="ft-tv__ctas">
          <button className="ft-cta" data-bot={playing ? "open-controller" : "play-on-tv"} onClick={go}>
            {playing ? <Gamepad size={20} /> : <TvIcon size={20} />}
            <span>{playing ? "Controller" : save ? "Continue" : "Play on TV"}</span>
          </button>
          {save && (
            <button className="ft-cta ft-cta--line" data-bot="start-new" onClick={() => store.update((x) => openStartNew(x, focusId))}>
              New
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The other couch games, lying on the table. One tap puts one up on the TV (or swaps to it). */
function OnTheTable({ s, store }: { s: S; store: Store<S> }) {
  const shelf = couchShelf(s).filter((a) => a.gameId !== (s.onTv ?? s.tvFocus));
  return (
    <ul className="ft-things" aria-label="Games on the table">
      {shelf.map((a, i) => (
        <li key={a.id} className={`ft-tilt-${i % 4}`}>
          <button className="ft-thing" data-bot={`act-${a.gameId}`} aria-label={`${gameById(a.gameId).name}: ${a.status.label}`} onClick={() => store.update((x) => pickActivity(x, a.gameId))}>
            <span className="ft-thing__art">
              <GameArt gameId={a.gameId} alt />
            </span>
            <b>{gameById(a.gameId).name}</b>
            <span className={`ft-thing__st ft-thing__st--${a.status.kind}`}>{a.status.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FamilyTable({ s, store }: { s: S; store: Store<S> }) {
  const here = hereTonight(s).map((p) => p.id);
  const kids = HOME.people.filter((p) => p.band !== "grownup");
  const grownups = HOME.people.filter((p) => p.band === "grownup" && p.id !== "dad");
  // A night on our TV sits at the head of the table (its homes ride along with it), not at a place.
  const nights = s.nights.list.filter((n) => !(n.status === "live" && n.gameId === s.onTv) && (n.status !== "setup" || n.homes.some((h) => h.reply === "invited")));
  return (
    <section className="ft-room" aria-label="At the table tonight">
      <div className="ft-chairs">
        <div className="ft-chairs__family">
          {[...kids, ...grownups].map((p, i) => (
            <Seat key={p.id} p={p} here={here.includes(p.id)} store={store} bot={i === 0 ? "couch-who" : undefined} />
          ))}
        </div>
        <div className="ft-chairs__guests">
          {nights.map((n) => (
            <PlaceSet key={n.id} n={n} s={s} store={store} />
          ))}
          {nights.length < 2 && (
          <button className="ft-place ft-place--new" data-bot="night-new" aria-label="Set a place for another home: new game night" onClick={() => store.update((x) => night(x, beginNewNight))}>
            <span className="ft-place__plate ft-place__plate--empty" aria-hidden>
              <Plus size={20} />
            </span>
            <span className="ft-place__card">
              <b>Set a place</b>
            </span>
          </button>
          )}
        </div>
      </div>
      <div className="ft-table">
        <TvGame s={s} store={store} />
        <OnTheTable s={s} store={store} />
      </div>
    </section>
  );
}
