import type { Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { roomArt } from "../launcher/home";
import { when } from "../launcher/layout";
import { stickerUrl } from "../session/data";
import { safeStyle } from "./art";

/** The game opened: its art fills the room, its logo, where you left off, Continue / Start game, who's playing. */
export function GamePage(props: {
  game: Manifest;
  state: SessionState;
  remoteHolder: string | null;
  now: number;
}) {
  const { game, state, now } = props;
  const paused = state.suspended.find((g) => g.appId === game.appId);
  const roster = state.rosters[game.appId] ?? [];
  const players = roster.length
    ? state.members.filter((m) => roster.some((r) => r.profileId === m.profileId))
    : state.members;
  const onStart = paused !== undefined && state.focus === "action:new";
  const art = roomArt(game);
  return (
    <div className="screen game-page" data-testid="game-page" data-page={game.appId}>
      <div className="page-art" data-cover-page={game.appId}>
        <img src={art.src} alt="" style={safeStyle(art.safe)} />
      </div>
      <div className="page-scrim" />
      <div className="page-card">
        {game.art.logo ? (
          <img className="page-logo" src={game.art.logo} alt={game.name} />
        ) : (
          <h1 className="page-title">{game.name}</h1>
        )}
        <p className="page-status">
          <span className="spot-tag">{paused ? `Paused ${when(paused.at, now)}` : "New"}</span>
          <span className="page-resume" data-testid="page-resume">
            {paused ? paused.label || game.tagline : game.tagline}
          </span>
        </p>
        <div className="page-actions">
          <span
            className={`action primary${onStart ? "" : " focused"}`}
            data-testid="action-continue"
          >
            <PlayGlyph />
            {paused ? (paused.label ? `Continue ${paused.label}` : "Continue") : "Start game"}
          </span>
          {paused && (
            <span className={`action${onStart ? " focused" : ""}`} data-testid="action-start">
              Start game
            </span>
          )}
        </div>
        <p className="page-hint">
          {props.remoteHolder
            ? `Press OK on ${props.remoteHolder}'s phone`
            : "Press OK on the phone"}
        </p>
      </div>
      <div className="page-players">
        <p className="eyebrow">{roster.length ? "Playing last time" : "Who's here"}</p>
        <div className="page-stickers">
          {players.map((p) => (
            <figure key={p.profileId} className="page-sticker" data-profile={p.profileId}>
              <img src={stickerUrl(p.sticker)} alt="" />
              <figcaption>{p.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg className="play-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4 L20 12 L7 20 Z" fill="currentColor" />
    </svg>
  );
}
