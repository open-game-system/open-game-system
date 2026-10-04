// Shelf swap on the TV: the TV is the family shelf. Left, the box that's in the console (open,
// its game inside); right, the shelf of boxes standing spine-out. One continuous story:
//   paused    — the game sinks into its open box; its spine under it says where you are.
//   saving    — the lid comes down; the resume point is written onto the spine. The next box
//               slides half out of the shelf.
//   cutover   — the closed box goes back on the shelf, into the gap the next box left, its spine
//               now reading "Mission 6 · saved 7:14 pm". The next box is in the console, lid on;
//               each person's sticker climbs onto it as their device arrives.
//   following — the lid lifts and the game opens out of its box to fill the screen.
import { gameById } from "../../../world";
import { savedAt, seatPlan, type S, type SwitchPhase } from "../state";
import { shelfOf, spineText } from "../shelf/model";
import { Spine, spineStyle } from "../shelf/Spine";
import { Portrait } from "../ui/Brand";
import { Check, Moon, PhoneIcon } from "../ui/Icons";
import { Clock, PulseMark } from "./Motif";
import { NowBand } from "./NowPlaying";
import { seatViews } from "./Roster";
import { TvArt } from "./TvArt";
import { GameArt } from "../ui/GameArt";

export type ShelfPhase = "paused" | SwitchPhase;

export function TvShelf({ s, from, to, phase, undo = false }: { s: S; from: string; to: string | null; phase: ShelfPhase; undo?: boolean }) {
  const stack = shelfOf(from);
  const gap = to ? stack.indexOf(to) : -1;
  const fromG = gameById(from);
  const inBox = phase === "cutover" || phase === "following" ? (to ?? from) : from;
  const fromText = phase === "paused" || phase === "saving" ? spineText(s, from) : { point: spineText(s, from).point, when: `saved ${savedAt({ from, to: to ?? from, phase: "saving", undo })}` };
  const seats = to ? seatViews(gameById(to), s.asleep, (x) => phase === "following" || (phase === "cutover" && x.device?.kind === "phone")) : [];
  return (
    <div className={`tsh tsh--${phase}`}>
      <div className="tsh__room" aria-hidden />
      <header className="ct-top tsh__top">
        <span className="ct-brand">
          <PulseMark size={52} />
          <span>{phase === "paused" ? "Living room · paused" : phase === "saving" ? `Putting ${fromG.name} away` : `${undo ? "Back to" : "Out comes"} ${gameById(to ?? from).name}`}</span>
        </span>
        {phase === "paused" && <Clock />}
      </header>

      {/* The box in the console. Keyed by its game so the new box arrives as its own object. */}
      <section key={inBox} className={`tsh-box ${inBox === from ? "tsh-box--old" : "tsh-box--new"}`} style={spineStyle(inBox)}>
        <div className="tsh-box__tray">
          <TvArt gameId={inBox} />
        </div>
        <div className="tsh-box__lid" aria-hidden>
          <span className="tsh-box__cover"><GameArt gameId={inBox} alt /></span>
          <span className="tsh-box__lidname ogs-display">{gameById(inBox).name}</span>
        </div>
        <div className="tsh-box__front">
          {inBox === from ? (
            <>
              <b className="ogs-display">{fromG.name}</b>
              <span className="tsh-box__point">
                <span className="tsh-box__ink">{fromText.point}</span>
                {phase === "saving" && <span className="tsh-box__writing">being written on the spine</span>}
                {phase === "paused" && <span className="tsh-box__note">· goes on the spine when you switch</span>}
              </span>
            </>
          ) : (
            <>
              <b className="ogs-display">{gameById(inBox).name}</b>
              <span className="tsh-box__point">{spineText(s, inBox).point}</span>
              <ul className="tsh-box__seats">
                {seats.map((x, i) => (
                  <li key={x.person.id} className={`is-${x.state}`} style={{ animationDelay: `${i * 160}ms` }}>
                    <Portrait person={x.person} size={64} dim={x.state !== "ready"} />
                    <i>{x.state === "ready" ? <Check size={22} /> : x.state === "asleep" ? <Moon size={20} /> : null}</i>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="tsh-shelf" aria-label="The shelf">
        <span className="ct-kicker tsh-shelf__k">{phase === "paused" ? "On the shelf" : "The shelf"}</span>
        <ul>
          {stack.map((id, i) => {
            const pulled = i === gap;
            const back = pulled && (phase === "cutover" || phase === "following");
            const gameId = back ? from : id;
            const people = seatPlan(gameById(gameId)).map((x) => x.person);
            return (
              <li key={`${i}-${gameId}`} className={`tsh-shelf__slot ${pulled ? (back ? "is-back" : "is-pulled") : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
                <Spine
                  gameId={gameId}
                  text={back ? fromText : spineText(s, id)}
                  people={back ? people : []}
                  sticker={36}
                  className="sp--tv"
                  tail={back ? <span className="tsh-shelf__check"><Check size={24} /></span> : null}
                />
              </li>
            );
          })}
        </ul>
        <span className="tsh-shelf__plank" aria-hidden />
      </section>

      {phase === "paused" && (
        <div className="tsh__hint">
          <PhoneIcon size={34} />
          Take one down on Jonathan's phone
        </div>
      )}
      {phase === "following" && to && <NowBand s={s} gameId={to} kicker={undo ? "Back to" : "Now playing"} seats={seats} settle={false} />}
    </div>
  );
}
