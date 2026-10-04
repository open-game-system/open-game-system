// The remote's screen: a live mirror of what the living room TV shows, with the remote deck welded
// under it. Three round keys, like a remote's: the big middle one is the thing you want most right
// now (Controller while a game is on; Continue / Play on the console home); the two flanking keys
// act on the TV (Pause and Swap while playing; New and Who's here on the console home).
import type { ReactNode } from "react";
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { activities } from "../../activities";
import { nightLine, openNight } from "../../nights";
import { castAndPlay, hereTonight, night, openMenu, openStartNew, pauseNightS, pointIn, saveOf, togglePause, type S } from "../../state";
import { LIVE, READY, st } from "../../status";
import { Chip } from "../../ui/Chip";
import { GameArt } from "../../ui/GameArt";
import { Gamepad, People, TvIcon } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";
import { PauseKey, PlayKey, SwapKey, Sparkle } from "./keys";

interface Key {
  bot: string;
  label: string;
  icon: ReactNode;
  aria?: string;
  on: (x: S) => S;
}

/** Which three keys the deck shows, from what the TV is doing. Pure. */
export function deckFor(s: S): { left: Key | null; main: Key | null; right: Key | null } {
  const playing = s.onTv;
  if (playing && gameById(playing).shape === "live") {
    const n = s.nights.list.find((x) => x.gameId === playing && x.status === "live");
    return {
      left: n ? { bot: "tv-pause", label: "Pause night", icon: <PauseKey />, on: (x) => pauseNightS(x, n.id) } : null,
      main: n ? { bot: `night-${n.id}`, label: "Game night", icon: <Gamepad size={30} />, on: (x) => night(x, (ns) => openNight(ns, n.id)) } : null,
      right: null,
    };
  }
  if (playing) {
    return {
      left: s.paused ? { bot: "tv-pause", label: "Resume", icon: <PlayKey />, on: togglePause } : { bot: "tv-pause", label: "Pause", icon: <PauseKey />, on: togglePause },
      main: { bot: "open-controller", label: "Controller", icon: <Gamepad size={32} />, on: (x) => ({ ...x, phone: "controller" }) },
      right: { bot: "tv-swap", label: "Swap", icon: <SwapKey />, aria: "Swap the game on the TV", on: openMenu },
    };
  }
  const focus = s.tvFocus;
  const couch = gameById(focus).shape === "couch";
  const save = couch && !s.fresh[focus] ? saveOf(focus) : null;
  const who: Key = { bot: "couch-who", label: "Who's here", icon: <People size={26} />, on: (x) => ({ ...x, who: true }) };
  return {
    left: save ? { bot: "start-new", label: "New", icon: <Sparkle />, aria: `Start ${gameById(focus).name} new`, on: (x) => openStartNew(x, focus) } : null,
    main: couch
      ? {
          bot: "play-on-tv",
          label: save ? "Continue" : "Play",
          icon: <TvIcon size={30} />,
          aria: save ? `Continue ${save.point.toLowerCase()} on the TV` : `Play ${gameById(focus).name} on the TV`,
          on: (x) => (x.cast === "off" ? castAndPlay(x, x.tvFocus) : { ...x, onTv: x.tvFocus, phone: "controller", paused: false }),
        }
      : null,
    right: who,
  };
}

function DeckKey({ k, main = false, store }: { k: Key | null; main?: boolean; store: Store<S> }) {
  if (!k) return <span className="rm-key rm-key--blank" aria-hidden />;
  return (
    <button className={`rm-key ${main ? "rm-key--main" : ""}`} data-bot={k.bot} aria-label={k.aria} onClick={() => store.update(k.on)}>
      <span className="rm-key__cap">{k.icon}</span>
      <span className="rm-key__label">{k.label}</span>
    </button>
  );
}

export function RemoteScreen({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const game = gameById(focusId);
  const act = activities(s).find((a) => a.gameId === focusId);
  const liveNight = s.nights.list.find((n) => n.status === "live" && n.gameId === playing);
  const here = hereTonight(s);
  const off = s.cast === "off";
  const held = !!playing && s.paused;
  const status = held ? st("paused", "Paused") : playing ? LIVE : (act?.status ?? READY);
  const line = playing ? (liveNight ? nightLine(liveNight) : pointIn(s, focusId)) : (act?.detail ?? game.tagline);
  const where = off ? "TV off" : playing ? "Living room TV" : "TV home screen";
  const deck = deckFor(s);
  return (
    <section className={`rm-remote ${held ? "is-held" : ""} ${playing ? "is-playing" : "is-home"}`} aria-label="The living room TV">
      <div className="rm-screen">
        <div className="rm-screen__art" key={focusId}>
          <GameArt gameId={focusId} />
        </div>
        <div className="rm-screen__top">
          <span className="rm-screen__where">
            <TvIcon size={16} /> {where}
          </span>
          <Chip status={status} />
        </div>
        {held && (
          <span className="rm-screen__held" aria-hidden>
            <PauseKey size={34} />
          </span>
        )}
        <div className="rm-screen__foot">
          <div className="rm-screen__title">
            <b>{game.name}</b>
            <span>{line}</span>
          </div>
          {playing && (
            <button className="rm-screen__who" data-bot="couch-who" aria-label={`${here.length} here tonight. Change who's here`} onClick={() => store.update((x) => ({ ...x, who: true }))}>
              {here.map((p) => (
                <Sticker key={p.id} person={p} size={34} />
              ))}
            </button>
          )}
        </div>
      </div>
      <div className="rm-deck">
        <DeckKey k={deck.left} store={store} />
        <DeckKey k={deck.main} main store={store} />
        <DeckKey k={deck.right} store={store} />
      </div>
    </section>
  );
}
