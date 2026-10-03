// The couch session's bar: who's here, on which device, in which seat. Like a call banner.
import { gameById, HOME, type Person } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, goBack, openSwitcher, ringAva, type S } from "../state";
import { Patch } from "../ui/Patch";
import { IconBack, IconBattery, IconSwap, IconTv, IconUndo } from "../ui/Icons";
import { seatFor } from "../ui/seats";
import { ON_COUCH } from "./PeopleHome";

function Seat({ p, gameId, s }: { p: Person; gameId: string; s: S }) {
  const asleep = p.id === "ava" && s.couch.avaAsleep;
  const following = p.band !== "grownup" && !s.couch.arrived.includes(p.id) && !asleep;
  return (
    <div className="pf-seat" data-asleep={asleep || undefined}>
      <Patch person={p} size={34} dim={asleep} />
      <div style={{ minWidth: 0 }}>
        <div className="pf-seat-name">{p.name}</div>
        <div className="pf-seat-role">
          {asleep ? (
            <>
              <IconBattery level={0.09} size={16} /> Asleep
            </>
          ) : following ? (
            "Following…"
          ) : (
            seatFor(gameId, p)
          )}
        </div>
      </div>
    </div>
  );
}

export function SessionBar({ s, store }: { s: S; store: Store<S> }) {
  const gameId = s.couch.gameId;
  const game = gameId ? gameById(gameId) : undefined;
  const swapping = s.couch.phase === "saving" || s.couch.phase === "cutover" || s.couch.phase === "following";
  const left = s.couch.left ? gameById(s.couch.left.gameId) : undefined;
  const ava = HOME.people.find((p) => p.id === "ava");
  return (
    <div className="pf-session">
      <div className="pf-session-top">
        <button className="pf-iconbtn" data-bot="back" aria-label="Back to People" onClick={() => store.update(go({ kind: "people", filter: "all" }))}>
          <IconBack />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="pf-session-title">Us, on the couch</h2>
          <p className="pf-session-sub">
            <IconTv size={15} /> Living room TV · {game?.name ?? "nothing on"}
          </p>
        </div>
        {!swapping && game && (
          <button className="pf-switch" data-bot="switch" onClick={() => store.update(openSwitcher)}>
            <IconSwap /> <span>Switch</span>
          </button>
        )}
      </div>
      {gameId && (
        <div className="pf-seats">
          {ON_COUCH.map((p) => (
            <Seat key={p.id} p={p} gameId={gameId} s={s} />
          ))}
        </div>
      )}
      {s.couch.phase === "playing" && s.couch.avaAsleep && ava && (
        <div className="pf-notice">
          <p>
            <b>Ava's iPad is asleep at 9%.</b> Her seat is saved; she's in the moment it's opened.
          </p>
          <button className="pf-secondary" data-bot="ring-ava" onClick={() => store.update(ringAva)} disabled={s.couch.ringing}>
            <span>{s.couch.ringing ? "Chiming…" : "Chime it"}</span>
          </button>
        </div>
      )}
      {s.couch.phase === "playing" && left && s.couch.left && (
        <button className="pf-undo" data-bot="undo" onClick={() => store.update(goBack)}>
          <img src={left.art.tv} alt="" />
          <span style={{ flex: 1, minWidth: 0 }}>
            {left.name} saved at {s.couch.left.savedAt}
          </span>
          <span className="pf-undo-act">
            <IconUndo /> Back to it
          </span>
        </button>
      )}
    </div>
  );
}
