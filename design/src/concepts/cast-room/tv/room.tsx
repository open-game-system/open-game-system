// The TV launcher: the family's own living room at night. Objects, not tiles: notes on the cork
// board (your turn), game night through the window, game boxes on the shelf, the family on the couch.
import { DUELS, HEARTHISLE, HOUSEHOLDS, gameById, type GameManifest } from "../../../world";
import { COUCH_GAMES, OPEN_DUELS, people, personOf, type S } from "../state";
import { SPOT } from "../actions";
import { gameVars, type Vars } from "../ui";

export function Spotlight({ focus, dim }: { focus: string; dim: boolean }) {
  const p = SPOT[focus];
  if (!p) return null;
  return (
    <div
      className="cr-spot"
      style={{
        background: `radial-gradient(circle ${p.r}px at ${p.x}px ${p.y}px, rgba(255,214,150,0.10) 0%, rgba(255,214,150,0.04) 55%, rgba(12,6,16,${dim ? 0.42 : 0.3}) 100%)`,
      }}
    />
  );
}

function Pin() {
  return <span className="cr-pin" />;
}

function Note({ id, focused, done }: { id: string; focused: boolean; done: boolean }) {
  const d = DUELS.find((x) => x.id === id);
  if (!d) return null;
  return (
    <div className={`cr-note ${focused ? "is-focus" : ""} ${done ? "is-done" : ""}`}>
      <Pin />
      <img className="cr-note-sticker" src={d.sticker} alt="" />
      <div className="cr-note-body">
        <div className="cr-note-who">{d.opponent}</div>
        <div className="cr-note-line">{done ? "Sent. Their move" : `played ${d.lastWord ?? "a word"}`}</div>
        <div className="cr-note-score">
          {done ? "Waiting" : "Your turn"} · {d.you}–{d.them}
        </div>
      </div>
    </div>
  );
}

export function Corkboard({ s }: { s: S }) {
  return (
    <div className="cr-cork">
      <div className="cr-cork-label">Your turn · Word Duel</div>
      <div className="cr-cork-notes">
        {OPEN_DUELS.map((d) => (
          <Note key={d.id} id={d.id} focused={s.focus === `d:${d.id}` && s.view.kind === "room"} done={s.duelsDone.includes(d.id)} />
        ))}
      </div>
    </div>
  );
}

function Crest({ householdId }: { householdId: string }) {
  const h = HOUSEHOLDS.find((x) => x.id === householdId);
  const seat = HEARTHISLE.seats.find((x) => x.householdId === householdId);
  if (!h || !seat) return null;
  const lead = h.people[0];
  return (
    <div className="cr-crest" style={{ borderColor: seat.color }}>
      {lead ? <img src={lead.sticker} alt="" /> : null}
      <span className="cr-crest-score" style={{ "--crest": seat.color } satisfies Vars}>
        {seat.score}
      </span>
    </div>
  );
}

export function GameNightWindow({ focused }: { focused: boolean }) {
  const g = gameById("hearthisle");
  return (
    <div className={`cr-window ${focused ? "is-focus" : ""}`}>
      <div className="cr-window-glass">
        <img src={g.art.extra?.night ?? g.art.tv} alt="" />
        <span className="cr-mullion-v" />
        <span className="cr-mullion-h" />
      </div>
      <div className="cr-sill">
        <div className="cr-sill-crests">
          {HEARTHISLE.seats.map((seat) => (
            <Crest key={seat.householdId} householdId={seat.householdId} />
          ))}
        </div>
        <div className="cr-sill-text">
          <div className="cr-sill-title">Game night tonight · 8 pm</div>
          <div className="cr-sill-line">Hearthisle turn 14 · Okafors are in</div>
        </div>
      </div>
    </div>
  );
}

export function WallClock() {
  return (
    <div className="cr-clock">
      <div className="cr-clock-face">
        <span className="cr-hand cr-hand-h" />
        <span className="cr-hand cr-hand-m" />
        <span className="cr-clock-dot" />
      </div>
      <div className="cr-clock-time">7:10</div>
      <div className="cr-clock-day">Friday</div>
    </div>
  );
}

export function Box({ g, s }: { g: GameManifest; s: S }) {
  const saved = s.saves[g.id];
  const focused = s.view.kind === "room" && s.focus === `g:${g.id}`;
  const paused = saved?.when.startsWith("Paused") ?? false;
  return (
    <div className={`cr-box ${focused ? "is-focus" : ""}`} style={gameVars(g)}>
      <div className="cr-box-art">
        <img src={g.art.tv} alt="" />
      </div>
      {paused ? <span className="cr-ribbon" /> : null}
      <div className="cr-box-band">
        <div className="cr-box-name">{g.name}</div>
        <div className="cr-box-at">{saved ? saved.at : "New"}</div>
      </div>
      <div className="cr-box-tag">{saved?.when ?? ""}</div>
    </div>
  );
}

export function Shelf({ s }: { s: S }) {
  return (
    <div className="cr-shelf">
      <div className="cr-shelf-boxes">
        {COUCH_GAMES.map((g) => (
          <Box key={g.id} g={g} s={s} />
        ))}
      </div>
      <div className="cr-plank" />
    </div>
  );
}

export function Couch({ here, crew }: { here: string[]; crew?: string[] }) {
  return (
    <div className="cr-couch">
      <div className="cr-couch-back" />
      <div className="cr-couch-people">
        {here.map((id) => {
          const p = personOf(id);
          const on = !crew || crew.includes(id);
          return (
            <div key={id} className={`cr-sitter ${on ? "" : "is-off"}`}>
              <img src={p.sticker} alt="" />
            </div>
          );
        })}
      </div>
      <div className="cr-couch-seat">
        {here.map((id) => (
          <span key={id} className="cr-sitter-name">
            {personOf(id).name}
          </span>
        ))}
      </div>
      <span className="cr-couch-arm cr-couch-arm-l" />
      <span className="cr-couch-arm cr-couch-arm-r" />
    </div>
  );
}

export function RemoteChip({ s }: { s: S }) {
  const holder = personOf(s.holder);
  if (s.asleep)
    return (
      <div className="cr-remote-chip is-warn">
        <span className="cr-remote-glyph" />
        {holder.name}'s phone is asleep · any grown-up phone can pick up the remote
      </div>
    );
  return (
    <div className="cr-remote-chip">
      <span className="cr-remote-glyph" />
      {s.fresh ? `Pick a game with ${holder.name}'s phone` : `${holder.name} has the remote`}
    </div>
  );
}

export function Room({ s }: { s: S }) {
  const here = people.map((p) => p.id);
  const inRoom = s.view.kind === "room";
  return (
    <div className="cr-room">
      <div className="cr-wall" />
      <div className="cr-lamp-glow" />
      <div className="cr-title">The Mumms' living room</div>
      <Corkboard s={s} />
      <WallClock />
      <GameNightWindow focused={inRoom && s.focus === "night"} />
      <Shelf s={s} />
      <Couch here={here} />
      <RemoteChip s={s} />
      {inRoom ? <Spotlight focus={s.focus} dim={false} /> : null}
    </div>
  );
}
