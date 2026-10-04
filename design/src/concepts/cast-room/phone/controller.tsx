// The phone while the TV shows the room: the top half is the room in your hand, the bottom half the
// remote. Either one drives the same spotlight on the TV.
import { DUELS, HEARTHISLE, HOUSEHOLDS, gameById } from "../../../world";
import { open, start, togglePerson } from "../actions";
import { people, personOf, roleFor, type S } from "../state";
import { gameVars } from "../ui";
import { MiniRoom } from "./mini";
import { Remote } from "./remote";

type Act = (fn: (s: S) => S) => void;

export function describe(s: S): string {
  const f = s.focus;
  if (f === "night") return "Game night · Hearthisle turn 14";
  if (f.startsWith("g:")) {
    const id = f.slice(2);
    return `${gameById(id).name} · ${s.saves[id]?.at ?? "New"}`;
  }
  if (f.startsWith("d:")) {
    const d = DUELS.find((x) => `d:${x.id}` === f);
    return d ? `Word Duel with ${d.opponent} · your turn` : "Word Duel";
  }
  return "";
}

export function TvChip({ s, act }: { s: S; act: Act }) {
  const big = s.layout === "remote";
  return (
    <div className="cr-phead">
      <div className="cr-tvchip">
        <span className="cr-live-dot" />
        <span>Living room TV</span>
      </div>
      <button
        type="button"
        className="cr-layout-btn"
        data-bot={big ? "layout-both" : "layout-remote"}
        onClick={() => act((x) => ({ ...x, layout: big ? "both" : "remote" }))}
      >
        {big ? "Show the room" : "Just the remote"}
      </button>
    </div>
  );
}

function DetailCard({ s, gameId, act }: { s: S; gameId: string; act: Act }) {
  const g = gameById(gameId);
  const saved = s.saves[gameId];
  const isNew = !saved || saved.at === "New game";
  return (
    <div className="cr-dcard" style={gameVars(g)}>
      <div className="cr-dcard-art">
        <img src={g.art.tv} alt="" />
      </div>
      <div className="cr-dcard-head">
        <div className="cr-dcard-name">{g.name}</div>
        <div className="cr-dcard-at">
          {saved?.at ?? g.tagline} · {saved?.when ?? ""}
        </div>
      </div>
      <div className="cr-dcard-who">
        {people.map((p) => {
          const on = s.pick.includes(p.id);
          return (
            <button key={p.id} type="button" className={`cr-seat ${on ? "is-on" : ""}`} data-bot={`who-${p.id}`} aria-pressed={on} onClick={() => act((x) => togglePerson(x, p.id))}>
              <img src={p.sticker} alt="" />
              <span className="cr-seat-name">{p.name}</span>
              <span className="cr-seat-role">{on ? roleFor(g, p) : "Not playing"}</span>
            </button>
          );
        })}
      </div>
      <div className="cr-dcard-actions">
        <button type="button" className="cr-btn is-primary" data-bot="continue" onClick={() => act((x) => start(x, gameId, false))}>
          {isNew ? "Start" : `Continue ${saved.at}`}
        </button>
        <button type="button" className="cr-btn" data-bot="new" onClick={() => act((x) => start(x, gameId, true))}>
          New game
        </button>
      </div>
    </div>
  );
}

function NightCard({ act }: { act: Act }) {
  return (
    <div className="cr-dcard cr-ncard">
      <div className="cr-dcard-head">
        <div className="cr-dcard-name">Game night</div>
        <div className="cr-dcard-at">Hearthisle · turn 14 · resumes 8 pm</div>
      </div>
      <div className="cr-ncard-homes">
        {HEARTHISLE.seats.map((seat) => {
          const h = HOUSEHOLDS.find((x) => x.id === seat.householdId);
          const lead = h?.people[0];
          return (
            <div key={seat.householdId} className="cr-ncard-home">
              {lead ? <img src={lead.sticker} alt="" style={{ borderColor: seat.color }} /> : null}
              <span className="cr-ncard-name">{h?.name ?? seat.label}</span>
              <span className="cr-ncard-state">{seat.online ? "In" : "Not yet"}</span>
            </div>
          );
        })}
      </div>
      <div className="cr-dcard-actions">
        <button type="button" className="cr-btn is-primary" data-bot="join" onClick={() => act((x) => ({ ...x, view: { kind: "game", gameId: "hearthisle" }, crew: ["dad", "juneau"] }))}>
          Join the table
        </button>
      </div>
    </div>
  );
}

function Top({ s, act }: { s: S; act: Act }) {
  const v = s.view;
  if (v.kind === "detail") return <DetailCard s={s} gameId={v.gameId} act={act} />;
  if (v.kind === "night") return <NightCard act={act} />;
  return (
    <div className="cr-top-room">
      <MiniRoom s={s} onOpen={(id) => act((x) => open(x, id))} />
      <div className="cr-caption">
        {s.note ? (
          <span className="cr-caption-note">{s.note}</span>
        ) : s.fresh ? (
          <span>Tap anything in the room, or use the remote</span>
        ) : (
          <>
            <span className="cr-caption-k">On the TV</span> <span>{describe(s)}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Controller({ s, act }: { s: S; act: Act }) {
  const big = s.layout === "remote";
  return (
    <div className="cr-controller">
      <TvChip s={s} act={act} />
      {big ? (
        <div className="cr-ontv">
          <span className="cr-caption-k">On the TV</span>
          <span className="cr-ontv-what">{s.view.kind === "detail" ? `${gameById(s.view.gameId).name}: ${s.focus.startsWith("p:") ? personOf(s.focus.slice(2)).name : s.focus === "new" ? "New game" : "Continue"}` : describe(s)}</span>
        </div>
      ) : (
        <Top s={s} act={act} />
      )}
      <Remote act={act} big={big} />
    </div>
  );
}
