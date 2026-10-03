// The TV during a switch, and the timeline every other device mirrors:
//   saving   — the game folds into a card and saves itself; the next game waits at the right
//   cutover  — the next game opens full-bleed; the saved card flies to a corner and fades;
//              a dotted follow path leads to "Now playing"; phones are in, iPads on their way
//   following — each iPad seat lights up as its device arrives (asleep stays asleep, seat kept)
// Then the game takes the TV and the band settles into the corner chip (TvPlaying).
import { gameById } from "../../../world";
import { resumeDetail, resumePoint, type Switching } from "../state";
import { Check } from "../ui/Icons";
import { FollowPath, PulseMark } from "./Motif";
import { NowBand } from "./NowPlaying";
import { seatViews } from "./Roster";
import { TvArt } from "./TvArt";

export function TvCutover({ sw, asleep }: { sw: Switching; asleep: string[] }) {
  const to = gameById(sw.to);
  const seats = seatViews(to, asleep, (x) => sw.phase === "following" || x.device?.kind === "phone");
  return (
    <div className={`ct-cut ct-cut--${sw.phase} ${sw.undo ? "" : "ct-cut--menu"}`}>
      <div className="ct-cut__blur" aria-hidden>
        <TvArt gameId={sw.from} />
      </div>
      <div className="ct-cut__to">
        <TvArt gameId={sw.to} />
      </div>
      {sw.phase !== "saving" && <NowBand gameId={sw.to} kicker={sw.undo ? "Back to" : "Now playing"} seats={seats} settle={false} stagger={sw.phase === "following" ? 260 : 0} />}
      <SavedCard gameId={sw.from} />
      {sw.phase === "cutover" && <FollowPath className="ct-cut__path" w={200} h={300} d="M150 10 C 170 120, 40 150, 30 290" />}
      {sw.phase === "saving" && <UpNext gameId={sw.to} undo={sw.undo} />}
      <span className="ct-cut__mark">
        <PulseMark size={48} />
      </span>
    </div>
  );
}

function SavedCard({ gameId }: { gameId: string }) {
  return (
    <div className="ct-cut__from">
      <div className="ct-cut__fromart">
        <TvArt gameId={gameId} />
      </div>
      <span className="ct-cut__saved">
        <span className="ct-cut__ring" aria-hidden>
          <svg viewBox="0 0 40 40" width="40" height="40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
            <circle className="ct-cut__ringfill" cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="100" transform="rotate(-90 20 20)" />
          </svg>
          <Check size={22} />
        </span>
        Saved · {resumePoint(gameId)}
      </span>
    </div>
  );
}

function UpNext({ gameId, undo }: { gameId: string; undo: boolean }) {
  const detail = resumeDetail(gameId);
  return (
    <section className="ct-cut__next">
      <span className="ct-kicker">{undo ? "Back to" : "Up next"}</span>
      <h2>{gameById(gameId).name}</h2>
      <p>
        {resumePoint(gameId)}
        {detail ? ` · ${detail}` : ""}
      </p>
    </section>
  );
}
