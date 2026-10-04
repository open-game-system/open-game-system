// Before anything else: put the living room on the TV. Then every game opens inside it.
import { useEffect } from "react";
import { gameById } from "../../../world";
import { connected } from "../actions";
import { people, personOf, roleFor, type S } from "../state";
import { MiniRoom } from "./mini";

type Act = (fn: (s: S) => S) => void;

function Family() {
  return (
    <div className="cr-family">
      {people.map((p) => (
        <div key={p.id} className="cr-family-p">
          <img src={p.sticker} alt="" />
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function Sheet({ s, act }: { s: S; act: Act }) {
  if (s.cast === "searching")
    return (
      <div className="cr-sheet">
        <div className="cr-sheet-title">Looking for TVs</div>
        <div className="cr-sheet-line">On the Mumm Home Wi-Fi</div>
        <div className="cr-searching">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (s.cast === "none-found")
    return (
      <div className="cr-sheet">
        <div className="cr-sheet-title">No TV found on this Wi-Fi</div>
        <ul className="cr-sheet-help">
          <li>Is the TV on, with the Chromecast showing?</li>
          <li>This phone is on Mumm Home. The Chromecast has to be too.</li>
        </ul>
        <button type="button" className="cr-btn is-primary" data-bot="retry" onClick={() => act((x) => ({ ...x, cast: "searching" }))}>
          Look again
        </button>
        <button type="button" className="cr-btn" data-bot="cancel" onClick={() => act((x) => ({ ...x, cast: "off" }))}>
          Not now
        </button>
      </div>
    );
  return (
    <div className="cr-sheet">
      <div className="cr-sheet-title">Which TV?</div>
      <button type="button" className="cr-tvrow" data-bot="tv-living" onClick={() => act((x) => ({ ...x, cast: "connecting" }))}>
        <span className="cr-tvicon" />
        <span className="cr-tvrow-text">
          <span className="cr-tvrow-name">Living room TV</span>
          <span className="cr-tvrow-state">Ready · where the couch is</span>
        </span>
        <span className="cr-chev-r" />
      </button>
      <div className="cr-tvrow is-off" aria-disabled>
        <span className="cr-tvicon" />
        <span className="cr-tvrow-text">
          <span className="cr-tvrow-name">Bedroom TV</span>
          <span className="cr-tvrow-state">Off or not on this Wi-Fi</span>
        </span>
      </div>
      <button type="button" className="cr-btn" data-bot="cancel" onClick={() => act((x) => ({ ...x, cast: "off" }))}>
        Cancel
      </button>
    </div>
  );
}

export function PreCast({ s, act, shot }: { s: S; act: Act; shot: boolean }) {
  useEffect(() => {
    if (shot) return;
    if (s.cast === "searching") {
      const t = setTimeout(() => act((x) => (x.cast === "searching" ? { ...x, cast: "picking" } : x)), 1300);
      return () => clearTimeout(t);
    }
    if (s.cast === "connecting") {
      const t = setTimeout(() => act((x) => (x.cast === "connecting" ? connected(x) : x)), 1700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [s.cast, shot, act]);

  const connecting = s.cast === "connecting";
  const resume = s.resumeView;
  const sheet = s.cast === "picking" || s.cast === "searching" || s.cast === "none-found";
  return (
    <div className="cr-precast">
      <div className="cr-precast-body" aria-hidden={sheet}>
      <div className="cr-precast-head">
        <div className="cr-precast-eyebrow">Friday night</div>
        <div className="cr-precast-title">{connecting ? "Turning on the living room" : "The Mumms"}</div>
      </div>
      <div className={`cr-precast-room ${connecting ? "is-lighting" : ""}`}>
        <MiniRoom s={s} dark={!connecting} />
      </div>
      {connecting ? (
        <div className="cr-connect">
          <div className="cr-connect-bar">
            <span />
          </div>
          <div className="cr-connect-line">
            {resume?.kind === "game" ? `Bringing ${gameById(resume.gameId).name} back at ${s.saves[resume.gameId]?.at ?? "where it was"}` : "Living room TV · the room appears on the TV"}
          </div>
        </div>
      ) : (
        <>
          <Family />
          <p className="cr-precast-why">Put the living room on the TV first. Every game opens inside it, so switching games never recasts.</p>
          <button type="button" className="cr-btn is-primary is-cast" data-bot="cast" onClick={() => act((x) => ({ ...x, cast: "picking" }))}>
            <span className="cr-castglyph" />
            Put it on the TV
          </button>
          <div className="cr-precast-turns">2 Word Duel turns wait for you, TV or not</div>
        </>
      )}
      </div>
      {sheet ? (
        <>
          <div className="cr-scrim" />
          <Sheet s={s} act={act} />
        </>
      ) : null}
    </div>
  );
}

export function Dropped({ s, act }: { s: S; act: Act }) {
  const v = s.resumeView;
  const what = v?.kind === "game" ? `${gameById(v.gameId).name} is saved at ${s.saves[v.gameId]?.at ?? "where it was"}` : "The room is just as you left it";
  return (
    <div className="cr-dropped">
      <div className="cr-dropped-art">
        <MiniRoom s={s} dark />
      </div>
      <div className="cr-dropped-title">The TV lost the picture</div>
      <div className="cr-dropped-line">{what}. Everyone's iPads are waiting, nothing to redo.</div>
      <button type="button" className="cr-btn is-primary" data-bot="recast" onClick={() => act((x) => ({ ...x, cast: "connecting" }))}>
        Put it back on the living room TV
      </button>
    </div>
  );
}

/** Another grown-up's phone: it can pick up the remote whenever the holder's phone sleeps. */
export function OtherPhone({ s, act }: { s: S; act: Act }) {
  const me = personOf(s.phoneOf);
  const holder = personOf(s.holder);
  return (
    <div className="cr-other">
      <div className="cr-other-head">
        <img src={me.sticker} alt="" />
        <div>
          <div className="cr-precast-eyebrow">{me.name}'s phone</div>
          <div className="cr-other-title">{s.view.kind === "game" ? `${gameById(s.view.gameId).name} is on the TV` : "Living room TV is on"}</div>
        </div>
      </div>
      <div className="cr-other-room">
        <MiniRoom s={s} />
      </div>
      <div className="cr-other-card">
        <div className="cr-other-line">
          {s.asleep ? `${holder.name}'s phone went to sleep. ` : `${holder.name} has the remote. `}
          {s.view.kind === "game" ? `Pick up the ${roleFor(gameById(s.view.gameId), me)} controls and Home; nobody else has to do anything.` : "Pick it up and the spotlight is yours."}
        </div>
        <button type="button" className="cr-btn is-primary" data-bot="take-remote" onClick={() => act((x) => ({ ...x, holder: x.phoneOf, asleep: false, note: "You have the remote" }))}>
          {s.view.kind === "game" ? `Take over as ${roleFor(gameById(s.view.gameId), me)}` : "Pick up the remote"}
        </button>
      </div>
    </div>
  );
}
