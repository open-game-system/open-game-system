// "Lobby table": the whole game night is one screen, a round table seen from above. The board is
// the tabletop; each home has a seat around it (crest, a status light, which screen it plays on, a
// lock for what it shows the other homes); the host's controls sit in one tray at the foot. Every
// state of the night (inviting, filling, live, paused at turn 14, a home dropped, finished) is this
// same table in a different state.
import type { ReactNode } from "react";
import type { Store } from "../../../../harness/store";
import { HOME, person } from "../../../../world";
import { beginNewNight, declined, endNight, everyoneBack, focusSeat, homeName, removeHome, short, togglePick, toggleSplit, US, whenWords, type Night, type Nights, anotherNight, dropDeclined, inviteInstead, sendInvites, otherHomes } from "../../nights";
import { night, pauseNightS, resumeNightS, startNightS, type S } from "../../state";
import { GameArt } from "../../ui/GameArt";
import { Crest, Sticker } from "../../ui/Sticker";
import { Close, Eye, Gamepad, Lock, PhoneIcon, TvIcon } from "../../ui/Icons";
import { phaseOf, seatAngles, seatsOf, type Drop, type Phase, type SeatView } from "./table";

const W = 390;
const CX = W / 2;
const CY = 178;
const TABLE_R = 98;
const RX = 126;
const RY = 136;

const nightsOf = (store: Store<S>, f: (ns: Nights) => Nights) => store.update((x) => ({ ...x, nights: f(x.nights) }));

// ---------- the table ----------

function Center({ n, phase, seats, drop, viewer }: { n: Night | undefined; phase: Phase; seats: SeatView[]; drop: Drop | null; viewer: string }) {
  const turnName = n ? (n.turnOf === viewer ? "Your roll" : `${short(homeName(n, n.turnOf))} to roll`) : "";
  const dropName = drop && n ? short(homeName(n, drop.householdId)) : "";
  const waiting = seats.filter((x) => x.word === "Invited").length;
  const coming = seats.filter((x) => x.light !== "away" && x.light !== "empty").length;
  const best = n ? [...n.homes].sort((a, b) => b.score - a.score)[0] : undefined;
  const c: Record<Phase, [string, string, string]> = {
    inviting: ["New night", "8:00", `tonight · ${seats.filter((x) => x.picked).length} homes`],
    filling: ["Invites out", String(waiting), waiting === 1 ? "home to answer" : "homes to answer"],
    declined: ["Tonight", `${coming} of ${seats.length}`, "homes can come"],
    ready: ["Everyone's in", String(seats.length), `homes · ${whenWords(n?.when ?? null)}`],
    live: ["Turn", String(n?.turn ?? 0), turnName],
    paused: ["Paused at turn", String(n?.turn ?? 0), whenWords(n?.when ?? null)],
    dropped: ["Held at turn", String(n?.turn ?? 0), `${dropName} offline`],
    holding: ["Held at turn", String(n?.turn ?? 0), `waiting for ${dropName}`],
    finished: ["Final", best ? short(best.name) : "", `win · ${best?.score ?? 0} points`],
  };
  const [kicker, big, sub] = c[phase];
  return (
    <div className="lt-center">
      <span className="lt-center__kicker">{kicker}</span>
      <b className={`lt-center__big ${big.length > 4 ? "is-word" : ""}`}>{big}</b>
      <span className="lt-center__sub">{sub}</span>
    </div>
  );
}

function SeatLight({ seat }: { seat: SeatView }) {
  return (
    <span className={`lt-light lt-light--${seat.light}`}>
      <i aria-hidden />
      {seat.word}
    </span>
  );
}

function Seat({ seat, angle, open, onTap }: { seat: SeatView; angle: number; open: boolean; onTap: () => void }) {
  const rad = (angle * Math.PI) / 180;
  const x = CX + RX * Math.cos(rad);
  const y = CY + RY * Math.sin(rad);
  const upper = Math.sin(rad) < -0.1;
  const juneau = seat.kid ? person("juneau") : undefined;
  return (
    <button
      className={`lt-seat ${upper ? "is-upper" : ""} ${seat.turn ? "is-turn" : ""} lt-seat--${seat.light} ${open ? "is-open" : ""}`}
      style={{ left: x, top: y }}
      data-bot={seat.light === "empty" || (seat.word === "Will invite") ? `pick-${seat.householdId}` : `seat-${seat.key}`}
      aria-label={`${seat.name}: ${seat.word}`}
      onClick={onTap}
    >
      <span className="lt-seat__chair" style={{ outlineColor: seat.color }}>
        {juneau ? <Sticker person={juneau} size={50} /> : <Crest household={seat.crest} size={54} shared dim={seat.light === "away" || seat.light === "empty"} />}
        <span className="lt-seat__lock" aria-hidden>
          <Lock size={13} />
        </span>
        {seat.light === "empty" && <span className="lt-seat__plus" aria-hidden>+</span>}
      </span>
      <span className="lt-seat__label">
        <b>{seat.name}{seat.score !== null ? <em> · {seat.score}</em> : null}</b>
        <SeatLight seat={seat} />
        <span className="lt-seat__screen">
          {seat.screen === "tv" ? <TvIcon size={13} /> : <PhoneIcon size={13} />} {seat.screenWord}
        </span>
      </span>
    </button>
  );
}

export function Table({ s, n, phase, seats, drop, viewer, store }: { s: S; n: Night | undefined; phase: Phase; seats: SeatView[]; drop: Drop | null; viewer: string; store: Store<S> | null }) {
  const angles = seatAngles(seats.length);
  const turnIndex = seats.findIndex((x) => x.turn);
  const turnAngle = turnIndex >= 0 ? (angles[turnIndex] ?? 90) : null;
  const tap = (seat: SeatView) => {
    if (!store) return;
    if (phase === "inviting" && seat.householdId !== US) nightsOf(store, (ns) => togglePick(ns, seat.householdId));
    else nightsOf(store, (ns) => focusSeat(ns, seat.key === "juneau" ? US : seat.householdId));
  };
  return (
    <div className={`lt-table lt-table--${phase}`} style={{ height: CY + RY + 100 }}>
      <div className="lt-top" style={{ left: CX - TABLE_R, top: CY - TABLE_R, width: TABLE_R * 2, height: TABLE_R * 2 }}>
        <span className="lt-top__board">
          <GameArt gameId={n?.gameId ?? "hearthisle"} />
        </span>
        <Center n={n} phase={phase} seats={seats} drop={drop} viewer={viewer} />
      </div>
      {turnAngle !== null && (
        <span
          className="lt-turnmark"
          aria-hidden
          style={{ left: CX + (TABLE_R + 2) * Math.cos((turnAngle * Math.PI) / 180), top: CY + (TABLE_R + 2) * Math.sin((turnAngle * Math.PI) / 180) }}
        />
      )}
      {seats.map((seat, i) => (
        <Seat key={seat.key} seat={seat} angle={angles[i] ?? 90} open={s.nights.seat === seat.householdId && (seat.key !== "juneau")} onTap={() => tap(seat)} />
      ))}
    </div>
  );
}

// ---------- one seat, opened ----------

function SeatCard({ s, n, seat, store }: { s: S; n: Night | undefined; seat: SeatView; store: Store<S> }) {
  const us = seat.householdId === US;
  const split = n?.homes.find((h) => h.householdId === US)?.seat === "split";
  const setup = !n || n.status === "setup" || n.status === "lobby";
  const kids = HOME.people.filter((p) => p.band !== "grownup");
  const close = () => nightsOf(store, (ns) => focusSeat(ns, null));
  const people = us ? HOME.people.filter((p) => p.id === "dad" || p.id === "juneau") : seat.crest.people;
  return (
    <section className="lt-card" aria-label={`${seat.name}'s seat`}>
      <header className="lt-card__head">
        <Crest household={seat.crest} size={44} shared />
        <span>
          <b>{us ? "Our seat" : seat.crest.name}</b>
          <span>
            {seat.colorName[0]?.toUpperCase()}
            {seat.colorName.slice(1)} · {seat.crest.city} · {seat.screenWord}
          </span>
        </span>
        <button className="cx-iconbtn lt-card__close" data-bot="seat-close" aria-label="Close seat" onClick={close}>
          <Close size={18} />
        </button>
      </header>
      {us ? (
        <>
          <div className="lt-card__who">
            {people.map((p) => (
              <span key={p.id}>
                <Sticker person={p} size={30} /> {p.name}
              </span>
            ))}
            <em>{split ? "two seats: blue and green" : "share blue: Juneau rolls, you place"}</em>
          </div>
          {setup && n && (
            <label className="cx-switchrow">
              <span>
                <b>Juneau gets his own seat</b>
                <span>{split ? "A green chair joins the table." : "Off: one chair for the two of you."}</span>
              </span>
              <input type="checkbox" role="switch" data-bot="seat-split" checked={split} onChange={() => nightsOf(store, toggleSplit)} />
            </label>
          )}
          <div className="lt-lock">
            <Lock size={16} />
            <span>
              <b>Other homes see: {s.nights.kidNames ? "The Mumms (Jonathan, Juneau)" : "The Mumms"} · blue</b>
              <span>{kids.map((k) => k.name).join(" and ")}'s pictures never leave this home. Their hands stay on our screens.</span>
            </span>
          </div>
          <label className="cx-switchrow">
            <span>
              <b>Show Juneau's name</b>
              <span>{s.nights.kidNames ? "On. Turn it off and it leaves every screen at once." : "Off by default."}</span>
            </span>
            <input type="checkbox" role="switch" data-bot="kid-names" checked={s.nights.kidNames} onChange={() => nightsOf(store, (ns) => ({ ...ns, kidNames: !ns.kidNames }))} />
          </label>
        </>
      ) : (
        <>
          <div className="lt-lock">
            <Lock size={16} />
            <span>
              <b>Their hands are theirs</b>
              <span>You see their seat, score and whose roll it is, on {seat.screen === "tv" ? "their own TV" : "their phones, no TV"}. They see only their own hands.</span>
            </span>
          </div>
          {seat.word === "Invited" && (
            <button className="cx-btn cx-btn--line lt-card__btn" data-bot="invite-preview" onClick={() => nightsOf(store, (ns) => ({ ...ns, preview: true }))}>
              <Eye size={18} /> <span>See the invite they got</span>
            </button>
          )}
          {setup && n && (
            <button className="cx-btn cx-btn--line lt-card__btn" data-bot={`remove-${seat.householdId}`} onClick={() => nightsOf(store, (ns) => focusSeat(removeHome(ns, seat.householdId), null))}>
              <span>Leave {seat.name} out</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ---------- the line under the table ----------

function Note({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="lt-note">
      <h2 className="ogs-display">{title}</h2>
      {children}
    </section>
  );
}

function HostNote({ s, n, phase, drop, store }: { s: S; n: Night | undefined; phase: Phase; drop: Drop | null; store: Store<S> }) {
  const paused = s.nights.list.filter((x) => x.status === "paused" && x.id !== n?.id);
  const others = n ? otherHomes(n).map((h) => short(h.name)) : [];
  switch (phase) {
    case "inviting":
      return (
        <Note title="Tap a chair to invite a home">
          <p>The board is shared; each home sees only its own hands.{paused[0] ? ` Your other night keeps its place at turn ${paused[0].turn}.` : ""}</p>
        </Note>
      );
    case "filling":
      return (
        <Note title={`Waiting on ${others.join(" and ")}`}>
          <p>Their chairs light up as they answer. Open any seat meanwhile.</p>
          <button className="cx-btn cx-btn--line lt-note__btn" data-bot="invite-preview" onClick={() => nightsOf(store, (ns) => ({ ...ns, preview: true }))}>
            <Eye size={18} /> <span>See what they see</span>
          </button>
        </Note>
      );
    case "declined": {
      const out = n ? declined(n).map((h) => short(h.name)).join(" and ") : "";
      return (
        <Note title={`${out} can't make it`}>
          <p>Nothing has started, so nothing is lost. Play on with the homes that are in, or:</p>
          <div className="lt-note__row">
            <button className="cx-btn cx-btn--line" data-bot="decline-invite-other" onClick={() => nightsOf(store, inviteInstead)}>
              <span>Invite someone</span>
            </button>
            <button className="cx-btn cx-btn--line" data-bot="decline-other-night" onClick={() => nightsOf(store, (ns) => anotherNight(ns, "Sat 8:00"))}>
              <span>Try Saturday</span>
            </button>
          </div>
        </Note>
      );
    }
    case "ready":
      return (
        <Note title="Everyone's in">
          <p>{s.nights.link ? "An invite link is out for the free chair. " : ""}Each home plays on the screen under its chair. Start puts turn 1 on every one.</p>
        </Note>
      );
    case "live": {
      const ours = n?.turnOf === US;
      const roller = n ? short(homeName(n, n.turnOf)) : "";
      return (
        <Note title={ours ? "Your roll, on the living room TV" : "You roll next"}>
          <p>{ours ? "Juneau rolls, you place. The other homes watch it happen on their own screens." : `${roller} are rolling on their ${n?.homes.find((h) => h.householdId === n.turnOf)?.screen === "phones" ? "phones" : "TV"}. It'll be in Your turn when it comes round.`}</p>
          {ours && (
            <button className="cx-btn cx-btn--light lt-note__btn" data-bot="night-controller" onClick={() => store.update((x) => ({ ...x, phone: "controller" }))}>
              <Gamepad size={20} /> <span>Controller</span>
            </button>
          )}
        </Note>
      );
    }
    case "paused": {
      const away = n ? n.homes.filter((h) => !h.back).map((h) => short(h.name)) : [];
      const by = n?.pausedBy === US ? "You paused" : n?.pausedBy ? `${short(homeName(n, n.pausedBy))} paused` : "Paused";
      return (
        <Note title={`${by} for every home`}>
          <p>Seats, hands and scores are kept. {away.length ? `Resume lights up when ${away.join(" and ")} are back.` : "Every home is back."}</p>
        </Note>
      );
    }
    case "dropped":
    case "holding": {
      const who = drop && n ? short(homeName(n, drop.householdId)) : "";
      return (
        <Note title={phase === "dropped" ? `The ${who} dropped off` : `Holding the board for the ${who}`}>
          <p>{phase === "dropped" ? "It was their roll. Their seat is held; you're hosting, so you decide." : "Every home sees it waiting. Nobody loses a move."}</p>
        </Note>
      );
    }
    case "finished":
      return (
        <Note title="Good game">
          <p>Final scores went to every home. The board is kept in Hearthisle's history.</p>
        </Note>
      );
  }
}

// ---------- the host's tray ----------

type TileState = "lit" | "on" | "off" | "held";
interface Tile {
  key: string;
  label: string;
  state: TileState;
  bot?: string;
  icon: ReactNode;
  act?: () => void;
}

const I = {
  start: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>,
  pause: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>,
  on: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 12h12M12 6l6 6-6 6" /><circle cx="20.5" cy="12" r="0.6" fill="currentColor" /></svg>,
  end: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 21V4M6 4h11l-2.5 4L17 12H6" /></svg>,
};

function tiles(s: S, n: Night | undefined, phase: Phase, drop: Drop | null, store: Store<S>): { list: Tile[]; hint: string } {
  const id = n?.id ?? "";
  const picked = s.nights.picked.length;
  const dropName = drop && n ? short(homeName(n, drop.householdId)) : "";
  const out = n ? declined(n).map((h) => short(h.name)).join(" and ") : "";
  const back = n ? everyoneBack(n) : false;
  const count = n ? n.homes.filter((h) => h.reply !== "declined").length : 0;
  const start: Tile =
    phase === "inviting"
      ? { key: "start", label: picked ? `Invite ${picked}` : "Invite", state: picked ? "lit" : "off", bot: "invite-send", icon: I.start, act: () => nightsOf(store, sendInvites) }
      : phase === "ready"
        ? { key: "start", label: "Start", state: "lit", bot: "night-start", icon: I.start, act: () => store.update(startNightS) }
        : phase === "paused"
          ? { key: "start", label: "Resume", state: back ? "lit" : "off", bot: "night-resume", icon: I.start, act: () => store.update((x) => resumeNightS(x, id)) }
          : phase === "finished"
            ? { key: "start", label: "Rematch", state: "lit", bot: "night-rematch", icon: I.start, act: () => store.update((x) => night(x, beginNewNight)) }
            : phase === "live" || phase === "dropped" || phase === "holding"
              ? { key: "start", label: "Live", state: "held", icon: I.start }
              : { key: "start", label: "Start", state: "off", icon: I.start };
  const pause: Tile =
    phase === "live"
      ? { key: "pause", label: "Pause all", state: "on", bot: "night-pause", icon: I.pause, act: () => store.update((x) => pauseNightS(x, id)) }
      : phase === "dropped"
        ? { key: "pause", label: "Hold", state: "lit", bot: "edge-night-wait", icon: I.pause, act: () => store.update((x) => (x.fault ? { ...x, fault: { ...x.fault, phase: "recovering", night: "wait" } } : x)) }
        : phase === "holding"
          ? { key: "pause", label: "Holding", state: "held", icon: I.pause }
          : phase === "paused"
            ? { key: "pause", label: "Paused", state: "held", icon: I.pause }
            : { key: "pause", label: "Pause all", state: "off", icon: I.pause };
  const playOn: Tile =
    phase === "dropped" || phase === "holding"
      ? { key: "on", label: "Play on", state: "on", bot: "edge-night-play-on", icon: I.on, act: () => store.update(playOnS) }
      : phase === "declined"
        ? { key: "on", label: `Play ${count}`, state: "lit", bot: "decline-play-on", icon: I.on, act: () => nightsOf(store, dropDeclined) }
        : { key: "on", label: "Play on", state: "off", icon: I.on };
  const canEnd = phase === "live" || phase === "paused" || phase === "dropped" || phase === "holding";
  const end: Tile = canEnd
    ? { key: "end", label: "End", state: "on", bot: "night-end", icon: I.end, act: () => store.update((x) => ({ ...x, fault: null, onTv: x.onTv === n?.gameId ? null : x.onTv, nights: endNight(x.nights, id) })) }
    : { key: "end", label: "End", state: phase === "finished" ? "held" : "off", icon: I.end };
  const hint: Record<Phase, string> = {
    inviting: picked ? `Sends ${picked} invite${picked > 1 ? "s" : ""} for tonight 8:00. Nothing starts until you press Start.` : "Tap a chair to invite a home.",
    filling: "Start lights up when every home has answered.",
    declined: `Play on starts with the ${count} homes that said yes. ${out}'s chair leaves the table.`,
    ready: "Start puts turn 1 on every home's screen at once.",
    live: `Pause stops the board for all ${n?.homes.length ?? 0} homes; it resumes when everyone's back.`,
    paused: back ? `Resume brings turn ${n?.turn ?? 0} back on every screen.` : "Resume waits until every home is back.",
    dropped: `Hold keeps their seat and waits. Play on skips the ${dropName}' turns until they're back.`,
    holding: `If they're not back in 10 minutes, Play on or Pause all.`,
    finished: "Rematch sets a new table with the same homes.",
  };
  return { list: [start, pause, playOn, end], hint: hint[phase] };
}

/** The host chose to play on without a home that dropped: its seat keeps its score and rejoins later. */
function playOnS(x: S): S {
  return { ...x, phone: "night", fault: x.fault ? { ...x.fault, phase: "recovered", night: "play-on" } : null };
}

function Tray({ s, n, phase, drop, store }: { s: S; n: Night | undefined; phase: Phase; drop: Drop | null; store: Store<S> }) {
  const { list, hint } = tiles(s, n, phase, drop, store);
  return (
    <footer className="lt-tray" aria-label="Host controls">
      <div className="lt-tray__tiles">
        {list.map((t) => (
          <button key={t.key} className={`lt-tile lt-tile--${t.state}`} data-bot={t.bot} disabled={t.state === "off" || t.state === "held"} aria-pressed={t.state === "held"} onClick={t.act}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="lt-tray__hint">{hint}</p>
    </footer>
  );
}

// ---------- the page ----------

export function LobbyTable({ s, store, drop, header }: { s: S; store: Store<S>; drop: Drop | null; header: ReactNode }) {
  const n = s.nights.list.find((x) => x.id === s.nights.open);
  const phase = phaseOf(n, drop);
  const seats = seatsOf(s.nights, n, drop);
  const open = seats.find((x) => x.householdId === s.nights.seat && x.key !== "juneau");
  return (
    <div className="cx-phone cx-nightpage lt-page">
      {header}
      <div className="cx-scroll lt-scroll">
        <Table s={s} n={n} phase={phase} seats={seats} drop={drop} viewer={US} store={store} />
        {open ? <SeatCard s={s} n={n} seat={open} store={store} /> : <HostNote s={s} n={n} phase={phase} drop={drop} store={store} />}
      </div>
      <Tray s={s} n={n} phase={phase} drop={drop} store={store} />
    </div>
  );
}

/** The same table from a guest home's phone (Nana's, Tunde's): their chair nearest, no host tray. */
export function GuestTable({ s, viewer, drop, title, line, action }: { s: S; viewer: string; drop: Drop | null; title: string; line: string; action?: ReactNode }) {
  const n = s.nights.list.find((x) => x.gameId === "hearthisle");
  const phase = phaseOf(n, drop);
  const seats = seatsOf(s.nights, n, drop, viewer);
  return (
    <div className="cx-scroll lt-scroll">
      <Table s={s} n={n} phase={phase} seats={seats} drop={drop} viewer={viewer} store={null} />
      <Note title={title}>
        <p>{line}</p>
        {action}
      </Note>
      <p className="lt-guest">Hosted by the Mumms · only the host can pause or play on</p>
    </div>
  );
}
