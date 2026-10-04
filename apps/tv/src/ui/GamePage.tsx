import type { Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { when } from "../launcher/layout";
import type { Household } from "../session/data";
import { stickerUrl } from "../session/data";

/** The box opened: its art, where you left off, Continue / New, and who's playing. */
export function GamePage(props: {
  game: Manifest;
  state: SessionState;
  household: Household;
  remoteHolder: string | null;
  now: number;
}) {
  const { game, state, household, now } = props;
  const paused = state.suspended.find((g) => g.appId === game.appId);
  const roster = state.rosters[game.appId] ?? [];
  const players = roster.length
    ? household.people.filter((p) => roster.some((r) => r.personId === p.id))
    : household.people;
  return (
    <div className="screen game-page" data-testid="game-page" data-page={game.appId}>
      <div className="page-art" data-cover-page={game.appId}>
        <img src={game.art.hero ?? game.art.tile} alt="" />
      </div>
      <div className="page-card">
        <p className="eyebrow">{paused ? `Paused ${when(paused.at, now)}` : "From the shelf"}</p>
        <h1 className="page-title">{game.name}</h1>
        <p className="page-resume" data-testid="page-resume">
          {paused ? paused.label : game.tagline}
        </p>
        <div className="page-actions">
          <span className="action primary focused" data-testid="action-continue">
            {paused ? `Continue ${paused.label}` : "Play"}
          </span>
          {paused && <span className="action">New game</span>}
        </div>
        <p className="page-hint">
          {props.remoteHolder ? `OK on ${props.remoteHolder}'s phone to start` : "OK to start"}
        </p>
      </div>
      <div className="page-players">
        <p className="eyebrow">{roster.length ? "Playing last time" : "Who's here"}</p>
        <div className="page-stickers">
          {players.map((p) => (
            <figure key={p.id} className="page-sticker">
              <img src={stickerUrl(p.sticker)} alt="" />
              <figcaption>{p.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
