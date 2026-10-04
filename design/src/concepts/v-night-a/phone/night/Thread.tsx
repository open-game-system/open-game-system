// The night's thread: one timeline among the homes, hung on the OGS dotted path. Each entry's node is
// the home that did it (its crest; kids are only ever part of their home's crest) or, for a turn
// milestone, a turn token. Under the last entry: what's happening now, and the board, the thread's
// live attachment.
import { useState } from "react";
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { household, nightStatus, short, US, whenWords, type Entry, type Night } from "../../nights";
import type { S } from "../../state";
import { Chip } from "../../ui/Chip";
import { GameArt } from "../../ui/GameArt";
import { Gamepad, PhoneIcon, TvIcon } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";
import { lineOf, nowOf, seatList, type Viewer } from "./words";

function Node({ home, turn, viewer }: { home: string | null; turn?: number; viewer: Viewer }) {
  if (turn !== undefined && home === null) return <span className="nt-node nt-node--turn ogs-display">{turn}</span>;
  if (!home) return <span className="nt-node nt-node--dot" />;
  return (
    <span className="nt-node">
      <Crest household={household(home)} size={40} shared={home !== viewer} />
    </span>
  );
}

function InviteCard({ n, e, viewer }: { n: Night; e: Extract<Entry, { kind: "invite" }>; viewer: Viewer }) {
  const to = e.to.map((id) => (id === viewer ? "You" : n.homes.find((h) => h.householdId === id)?.name ?? "")).filter(Boolean);
  const mine = n.homes.find((h) => h.householdId === viewer);
  return (
    <div className="nt-invite">
      <span className="nt-invite__art">
        <GameArt gameId={n.gameId} alt={n.id !== "hi-1"} />
      </span>
      <span className="nt-invite__body">
        <b className="ogs-display">{gameById(n.gameId).name} game night</b>
        <span>{e.when} · about an hour</span>
        {viewer === US ? (
          <span>To {to.join(" · ")}</span>
        ) : (
          <span>
            Your seat: {mine?.colorName ?? ""} · {mine?.screen === "phones" ? "on your phones" : "on your TV"}
          </span>
        )}
      </span>
    </div>
  );
}

function SeatStrip({ n, split, viewer, kidNames }: { n: Night; split: boolean; viewer: Viewer; kidNames: boolean }) {
  return (
    <ul className="nt-seats">
      {seatList(n, split, viewer, kidNames).map((x, i) => (
        <li key={`${x.home.householdId}-${i}`}>
          <span className="nt-seats__dot" style={{ background: x.color }} />
          <span className="nt-seats__word">{x.word}</span>
          <span className="nt-seats__who">{x.label}</span>
          <span className="nt-seats__where">{x.home.screen === "tv" ? <TvIcon size={15} /> : <PhoneIcon size={15} />}</span>
        </li>
      ))}
      <li className="nt-seats__rule">Each seat sees only its own hand. The board is shared.</li>
    </ul>
  );
}

function Row({ n, e, viewer, kidNames }: { n: Night; e: Exclude<Entry, { kind: "day" }>; viewer: Viewer; kidNames: boolean }) {
  const l = lineOf(e, n, viewer);
  const milestone = l.turn !== undefined;
  return (
    <li className={`nt-row nt-row--${e.kind} ${milestone ? "is-milestone" : ""} ${l.home === viewer ? "is-mine" : ""}`}>
      <Node home={l.home} turn={l.turn} viewer={viewer} />
      <div className="nt-row__body">
        <p className="nt-row__line">
          <b>{l.who}</b> {l.text}
          <time>{l.at}</time>
        </p>
        {e.kind === "invite" && <InviteCard n={n} e={e} viewer={viewer} />}
        {e.kind === "seats" && <SeatStrip n={n} split={e.split} viewer={viewer} kidNames={kidNames} />}
        {e.kind === "next" && (
          <span className="nt-when">
            <span className="nt-when__k">Back</span>
            <span className="nt-when__v ogs-display">{whenWords(e.when).replace(/^./, (c) => c.toUpperCase())}</span>
          </span>
        )}
      </div>
    </li>
  );
}

/** The board: the thread's live attachment. While the night is live it opens the controller. */
function Board({ n, s, store, viewer }: { n: Night; s: S; store: Store<S>; viewer: Viewer }) {
  const live = n.status === "live";
  const turnHome = n.homes.find((h) => h.householdId === n.turnOf);
  const line =
    n.status === "setup" ? "Opens in every home when you start" : `Turn ${n.turn} · ${n.turnOf === viewer ? "your roll" : `${short(turnHome?.name ?? "")} to roll`}${live ? "" : ", waiting"}`;
  const inner = (
    <>
      <span className="nt-board__art">
        <GameArt gameId={n.gameId} alt={n.id !== "hi-1"} />
      </span>
      <span className="nt-board__body">
        <span className="nt-board__top">
          <span className="nt-board__k">The board</span>
          {viewer === US && <Chip status={nightStatus(n, s.onTv)} />}
        </span>
        <b>{line}</b>
        {n.status !== "setup" && (
          <span className="nt-board__score">
            {n.homes
              .filter((h) => h.reply !== "declined")
              .map((h) => (
                <span key={h.householdId}>
                  <i style={{ background: h.color }} />
                  {short(h.householdId === viewer ? "You" : h.name)} {h.score}
                </span>
              ))}
          </span>
        )}
        {live && viewer === US && (
          <span className="nt-board__open">
            <Gamepad size={18} /> Open the board
          </span>
        )}
      </span>
    </>
  );
  if (live && viewer === US) {
    return (
      <li className="nt-attach">
        <button className="nt-board is-live" data-bot="night-controller" onClick={() => store.update((x) => ({ ...x, phone: "controller" }))}>
          {inner}
        </button>
      </li>
    );
  }
  return (
    <li className="nt-attach">
      <div className="nt-board">{inner}</div>
    </li>
  );
}

/** How many entries a thread shows before "Earlier": the latest few, so the now and the board lead. */
const RECENT = 4;

/** Where the recent part of the log starts: the last RECENT entries, plus the day label above them. */
function recentFrom(log: Entry[]): number {
  let seen = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]?.kind !== "day") seen++;
    if (seen === RECENT) return i > 0 && log[i - 1]?.kind === "day" ? i - 1 : i;
  }
  return 0;
}

export function Thread({ n, s, store, viewer }: { n: Night; s: S; store: Store<S>; viewer: Viewer }) {
  const now = nowOf(n, viewer);
  const [all, setAll] = useState(false);
  const from = all ? 0 : recentFrom(n.log);
  const hidden = n.log.slice(0, from).filter((e) => e.kind !== "day").length;
  const firstDay = n.log.slice(0, from + 1).filter((e) => e.kind === "day").at(-1);
  const shown = n.log.slice(from);
  const lead = !all && shown[0]?.kind !== "day" && firstDay ? [firstDay, ...shown] : shown;
  return (
    <ol className="nt-thread" aria-label={`${gameById(n.gameId).name} night`}>
      {hidden > 0 && (
        <li className="nt-earlier">
          <button data-bot="thread-earlier" onClick={() => setAll(true)}>
            {hidden} earlier {hidden === 1 ? "entry" : "entries"}
          </button>
        </li>
      )}
      {lead.map((e, i) =>
        e.kind === "day" ? (
          <li key={i} className="nt-day">
            <span>{e.label}</span>
          </li>
        ) : (
          <Row key={i} n={n} e={e} viewer={viewer} kidNames={s.nights.kidNames} />
        ),
      )}
      {now.map((x) => (
        <li key={`now-${x.home}`} className={`nt-row nt-now nt-now--${x.kind}`}>
          <span className="nt-node">
            <Crest household={household(x.home)} size={40} shared={x.home !== viewer} dim={x.kind === "away" || x.kind === "deciding"} />
          </span>
          <div className="nt-row__body">
            <p className="nt-row__line">
              <b>{x.text}</b>
              {x.kind !== "yours" && <span className="nt-dots" aria-hidden><i /><i /><i /></span>}
            </p>
            {x.kind === "deciding" && x.home === viewer && (
              <span className="nt-answer" aria-hidden>
                <span className="cx-btn cx-btn--light">We're in</span>
                <span className="cx-btn cx-btn--line">Can't make it</span>
              </span>
            )}
          </div>
        </li>
      ))}
      <Board n={n} s={s} store={store} viewer={viewer} />
    </ol>
  );
}
