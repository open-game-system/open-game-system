// The TV during a switch: the timeline every other device mirrors. Cause always lands before effect.
//   saving    — the game folds into a card and its save ring fills ("Saving · Mission 6"); the next
//               game waits as a tile on the right with tonight's seats under it, none in yet.
//   cutover   — the phone has its ✓; the same ✓ stamps onto the saved card ("Saved · Mission 6").
//               A dotted path swoops from the card to the next tile; the phones are in, the iPads
//               are on their way (their kids' characters are walking the same path on the iPads).
//   following — each iPad seat checks in, then the next game opens from its own tile to full screen;
//               the saved card tucks into the top-left corner and a "now playing" strip rises along
//               the bottom edge (never in the game's focal area).
// Then the game takes the TV and the strip collapses into the corner chip (TvPlaying).
import { gameById } from "../../../world";
import { detailIn, pointIn, type S, type Switching } from "../state";
import { Portrait } from "../ui/Brand";
import { Check, Moon } from "../ui/Icons";
import { FollowPath, PulseMark } from "./Motif";
import { NowBand } from "./NowPlaying";
import { seatViews, type SeatView } from "./Roster";
import { TvArt } from "./TvArt";

export function TvCutover({ s, sw, asleep }: { s: S; sw: Switching; asleep: string[] }) {
  const to = gameById(sw.to);
  // Phones are in from the cut-over (the phone said ✓ first); iPads check in when they follow.
  const seats = seatViews(to, asleep, (x) => sw.phase === "following" || (sw.phase === "cutover" && x.device?.kind === "phone"));
  return (
    <div className={`ct-cut ct-cut--${sw.phase} ${sw.undo ? "" : "ct-cut--menu"}`}>
      <div className="ct-cut__blur" aria-hidden>
        <TvArt gameId={sw.from} />
      </div>
      <div className="ct-cut__to">
        <TvArt gameId={sw.to} />
      </div>
      <SavedCard s={s} gameId={sw.from} saved={sw.phase !== "saving"} />
      {sw.phase !== "following" && <FollowPath className="ct-cut__path" w={560} h={190} d="M20 10 C 120 170, 420 190, 540 40" />}
      <UpNext s={s} gameId={sw.to} undo={sw.undo} seats={seats} />
      {sw.phase === "following" && <NowBand s={s} gameId={sw.to} kicker={sw.undo ? "Back to" : "Now playing"} seats={seats} settle={false} />}
      <span className="ct-cut__mark">
        <PulseMark size={48} />
      </span>
    </div>
  );
}

function SavedCard({ s, gameId, saved }: { s: S; gameId: string; saved: boolean }) {
  return (
    <div className="ct-cut__from">
      <div className="ct-cut__fromart">
        <TvArt gameId={gameId} />
      </div>
      <span className={`ct-cut__saved ${saved ? "is-saved" : ""}`}>
        <span className="ct-cut__ring" aria-hidden>
          <svg viewBox="0 0 40 40" width="40" height="40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
            <circle className="ct-cut__ringfill" cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="100" transform="rotate(-90 20 20)" />
          </svg>
          {saved && <Check size={22} />}
        </span>
        {saved ? "Saved" : "Saving"} · {pointIn(s, gameId)}
      </span>
    </div>
  );
}

function UpNext({ s, gameId, undo, seats }: { s: S; gameId: string; undo: boolean; seats: SeatView[] }) {
  const detail = detailIn(s, gameId);
  return (
    <section className="ct-cut__next">
      <span className="ct-kicker">{undo ? "Back to" : "Up next"}</span>
      <h2>{gameById(gameId).name}</h2>
      <p>
        {pointIn(s, gameId)}
        {detail ? ` · ${detail}` : ""}
      </p>
      <ul className="ct-cut__seats">
        {seats.map((x, i) => (
          <li key={x.person.id} className={`is-${x.state}`} style={{ animationDelay: `${i * 140}ms` }}>
            <Portrait person={x.person} size={60} dim={x.state !== "ready"} />
            <i style={{ animationDelay: `${i * 140}ms` }}>{x.state === "ready" ? <Check size={22} /> : x.state === "asleep" ? <Moon size={20} /> : null}</i>
            <span>{x.person.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
