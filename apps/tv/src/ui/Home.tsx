import type { Member } from "@open-game-system/ogs-protocol";
import { useEffect, useState } from "react";
import type { Art, CardModel, HomeModel, IconModel } from "../launcher/home";
import { clock } from "../launcher/layout";
import { type CouchSession, stickerUrl } from "../session/data";
import { safeStyle } from "./art";
import { Couch } from "./Couch";
import { roomTitle } from "./copy";
import { JoinCode } from "./JoinCode";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** What the room shows: the focused game, or the Surprise card's shuffle. */
type Spot = { kind: "game"; icon: IconModel } | { kind: "surprise"; icons: IconModel[] } | null;

function spotOf(home: HomeModel, focus: string | null): Spot {
  const icon = home.icons.find((i) => i.itemId === focus);
  if (icon) return { kind: "game", icon };
  const card = home.cards.find((c) => c.itemId === focus);
  if (card?.kind === "surprise")
    return { kind: "surprise", icons: home.icons.filter((i) => card.pool.includes(i.appId)) };
  const game = card && home.icons.find((i) => i.appId === card.appId);
  if (game) return { kind: "game", icon: game };
  const first = home.icons[0];
  return first ? { kind: "game", icon: first } : null;
}

/**
 * PS5-style home: the focused game's art fills the room with its logo in the left third, a row of
 * game icons across the top, and activity cards (sittings to jump back into, Surprise me) below.
 */
export function Home(props: {
  home: HomeModel;
  focus: string | null;
  session: CouchSession;
  members: Member[];
  /** Who played each game last time (its roster), for the spotlight. */
  playersOf: (appId: string) => Member[];
  remoteHolder: string | null;
  now: number;
}) {
  const { home, focus, session, now } = props;
  const spot = spotOf(home, focus);
  const inCards = home.cards.some((c) => c.itemId === focus);
  return (
    <div className="screen home" data-testid="home" data-zone={inCards ? "cards" : "icons"}>
      <Room spot={spot} />
      <header className="topbar">
        <h1 className="room-name">{roomTitle(session.tvName, session.host.name)}</h1>
        <div className="clock">
          <span className="clock-time">{clock(now)}</span>
          <span className="clock-day">{WEEKDAYS[new Date(now).getDay()]}</span>
        </div>
      </header>
      {home.icons.length > 0 ? (
        <div className="icon-row" data-row="games">
          {home.icons.map((i) => (
            <GameIcon
              key={i.itemId}
              icon={i}
              focused={i.itemId === focus}
              current={inCards && spot?.kind === "game" && spot.icon.appId === i.appId}
            />
          ))}
        </div>
      ) : (
        <EmptyHero name={props.remoteHolder} />
      )}
      {spot && (
        <Spotlight
          spot={spot}
          players={spot.kind === "game" ? props.playersOf(spot.icon.appId) : []}
        />
      )}
      {home.cards.length > 0 && (
        <div className="cards" data-row="activity">
          {home.cards.map((c) => (
            <Card key={c.itemId} card={c} focused={c.itemId === focus} />
          ))}
        </div>
      )}
      <aside className="people">
        <Couch members={props.members} />
        {props.remoteHolder && (
          <div className="remote-chip" data-testid="remote-chip">
            <RemoteIcon />
            {props.remoteHolder} has the remote
          </div>
        )}
      </aside>
      <JoinCode code={session.code} />
    </div>
  );
}

/** The whole room is the focused game's clean hero; the last one stays under it while it fades in. */
function Room({ spot }: { spot: Spot }) {
  const art = useShuffle(spot);
  const id = spot?.kind === "game" ? spot.icon.appId : spot ? "surprise" : "";
  const [layers, setLayers] = useState<Art[]>(art ? [art] : []);
  if (art && layers.at(-1)?.src !== art.src) setLayers([...layers.slice(-1), art]);
  return (
    <div
      className="room"
      data-testid="hero"
      data-hero={id}
      data-surprise={spot?.kind === "surprise" || undefined}
    >
      {layers.map((l, n) => (
        <img
          key={l.src}
          className={`room-art${n === layers.length - 1 ? " in" : ""}${l.captured ? " captured" : ""}`}
          src={l.src}
          alt=""
          style={safeStyle(l.safe)}
        />
      ))}
      <div className="room-scrim" />
    </div>
  );
}

/** On the Surprise card the room flips through every game, like a deck being shuffled. */
function useShuffle(spot: Spot): Art | null {
  const [tick, setTick] = useState(0);
  const shuffling = spot?.kind === "surprise";
  useEffect(() => {
    if (!shuffling || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), 1400);
    return () => clearInterval(t);
  }, [shuffling]);
  if (!spot) return null;
  if (spot.kind === "game") return spot.icon.room;
  return spot.icons[tick % Math.max(1, spot.icons.length)]?.room ?? null;
}

/** An icon; `current` is the game of the focused card: it stays large and named, without the ring. */
function GameIcon(props: { icon: IconModel; focused: boolean; current: boolean }) {
  const { icon, focused, current } = props;
  return (
    <div
      className={`game-icon${focused ? " focused" : ""}${current ? " current" : ""}`}
      data-item={icon.itemId}
      data-focused={focused || undefined}
    >
      <div className="game-icon-art" data-cover={icon.appId}>
        <img src={icon.icon.src} alt="" style={safeStyle(icon.icon.safe)} />
        {icon.tag.startsWith("Paused") && <span className="game-icon-dot" aria-hidden="true" />}
      </div>
      <span className="game-icon-name">{icon.name}</span>
    </div>
  );
}

/** The left third: the game's logo, large, and where you left off. */
function Spotlight({ spot, players }: { spot: NonNullable<Spot>; players: Member[] }) {
  if (spot.kind === "surprise")
    return (
      <div className="spotlight" key="surprise">
        <p className="spot-wordmark">Surprise me</p>
        <p className="spot-line">A game picked at random</p>
      </div>
    );
  const { icon } = spot;
  return (
    <div className="spotlight" key={icon.appId}>
      {icon.logo ? (
        <img className="spot-logo" src={icon.logo} alt={icon.name} />
      ) : (
        <p className="spot-wordmark">{icon.name}</p>
      )}
      <p className="spot-line">
        {icon.tag && <span className="spot-tag">{icon.tag}</span>}
        <span className="spot-resume">{icon.resume}</span>
      </p>
      {players.length > 0 && (
        <p className="spot-players" data-testid="spot-players">
          {players.map((m) => (
            <img key={m.profileId} src={stickerUrl(m.sticker)} alt="" />
          ))}
          <span>Played last time</span>
        </p>
      )}
    </div>
  );
}

function Card({ card, focused }: { card: CardModel; focused: boolean }) {
  const common = {
    "data-item": card.itemId,
    "data-focused": focused || undefined,
  };
  if (card.kind === "surprise")
    return (
      <div className={`card surprise${focused ? " focused" : ""}`} data-card="surprise" {...common}>
        <div className="card-art surprise-art">
          {card.icons.slice(0, 4).map((a, n) => (
            <img
              key={a.src}
              className={`fan fan-${n}`}
              src={a.src}
              alt=""
              style={safeStyle(a.safe)}
            />
          ))}
          <SurpriseMark />
        </div>
        <span className="card-name">Surprise me</span>
        <span className="card-resume">A game for the kids</span>
      </div>
    );
  return (
    <div
      className={`card${focused ? " focused" : ""}`}
      data-card="sitting"
      data-app={card.appId}
      {...common}
    >
      <div className="card-art">
        <img src={card.art.src} alt="" style={safeStyle(card.art.safe)} />
        <span className="card-tag">{card.tag}</span>
        {card.upcoming ? <ClockMark /> : <PlayMark />}
      </div>
      <span className="card-name">{card.name}</span>
      <span className="card-resume">{card.resume}</span>
    </div>
  );
}

function EmptyHero({ name }: { name: string | null }) {
  return (
    <div className="spotlight empty" data-testid="empty">
      <p className="spot-wordmark">No games yet</p>
      <p className="spot-line">Add games on {name ? `${name}'s` : "your"} phone, in Library</p>
    </div>
  );
}

/** A play triangle: this card jumps straight back in. */
function PlayMark() {
  return (
    <svg className="play-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="rgba(23,11,31,0.72)" />
      <path d="M19 14 L35 24 L19 34 Z" fill="currentColor" />
    </svg>
  );
}

/** A clock: tonight's game night is on the calendar, not paused. */
function ClockMark() {
  return (
    <svg className="play-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="rgba(23,11,31,0.72)" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path
        d="M24 17 V24 L29 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Two dice: a game picked for you. */
function SurpriseMark() {
  return (
    <svg className="surprise-mark" viewBox="0 0 96 96" aria-hidden="true">
      <g transform="rotate(-14 34 52)">
        <rect x="8" y="26" width="52" height="52" rx="12" fill="#f8ecd9" />
        <circle cx="22" cy="40" r="5" fill="#2a1533" />
        <circle cx="34" cy="52" r="5" fill="#2a1533" />
        <circle cx="46" cy="64" r="5" fill="#2a1533" />
      </g>
      <g transform="rotate(12 66 40)">
        <rect x="42" y="12" width="46" height="46" rx="11" fill="#f6bb52" />
        <circle cx="55" cy="25" r="4.5" fill="#2a1533" />
        <circle cx="75" cy="25" r="4.5" fill="#2a1533" />
        <circle cx="55" cy="45" r="4.5" fill="#2a1533" />
        <circle cx="75" cy="45" r="4.5" fill="#2a1533" />
      </g>
    </svg>
  );
}

export function RemoteIcon() {
  return (
    <svg className="remote-icon" viewBox="0 0 20 32" aria-hidden="true">
      <rect
        x="2"
        y="1"
        width="16"
        height="30"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  );
}
