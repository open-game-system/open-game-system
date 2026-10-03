// Word Duel inside Porchlight: one game per opponent, grouped by whose move it is.
import type { ReactNode } from "react";
import type { Store } from "../../../harness/store";
import type { DuelGame } from "../../../world";
import { NOW } from "../../../world";
import { StatusBar } from "../ui/Bits";
import { Chevron, Plus } from "../ui/Icons";
import { TileWord } from "../phone/Noticeboard";
import { NewDuel } from "./NewDuel";
import type { S } from "../state";

export const ago = (iso: string): string => {
  const m = Math.round((NOW.getTime() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export function DuelList({ s, store }: { s: S; store: Store<S> }) {
  const g = (k: DuelGame["status"]) => s.duels.filter((d) => d.status === k);
  const yours = g("yourTurn");
  const waiting = g("waiting");
  const done = [...g("completed"), ...g("expired")];
  const open = (id: string) => store.update((x) => ({ ...x, phone: "duel", openDuel: id, placed: [], sent: false }));
  return (
    <div className="pl pl-phone">
      <StatusBar time={s.clock} />
      <div className="pl-navbar">
        <button className="pl-back" data-bot="back-home" onClick={() => store.update((x) => ({ ...x, phone: "home" }))}>
          <span>
            {" "}
            <Chevron dir="left" size={18} /> Tonight
          </span>
        </button>
        <button className="pl-btn pl-btn--secondary pl-btn--sm" data-bot="new-duel" onClick={() => store.update((x) => ({ ...x, sheet: "new-duel" }))}>
          <span>
            {" "}
            <Plus size={16} /> New game
          </span>
        </button>
      </div>
      <div className="pl-scroll pl-scroll--nav">
        <h1 className="pl-h1 pl-duel-h1">Word Duel</h1>
        {s.duels.length === 0 ? (
          <Empty store={store} />
        ) : (
          <>
            <Group title={yours.length ? `Your move · ${yours.length}` : "Your move"} tone="yours">
              {yours.length === 0 && <p className="pl-duel-none">All caught up. Nobody's waiting on you.</p>}
              {yours.map((d, i) => (
                <Row key={d.id} d={d} primary={i === 0} onOpen={() => open(d.id)} />
              ))}
            </Group>
            <Group title={`Their move · ${waiting.length}`}>
              {waiting.map((d) => (
                <Row key={d.id} d={d} onOpen={() => open(d.id)} />
              ))}
            </Group>
            <Group title="Finished">
              {done.map((d) => (
                <Row key={d.id} d={d} onOpen={() => store.update((x) => ({ ...x, sheet: "new-duel" }))} />
              ))}
            </Group>
          </>
        )}
      </div>
      {s.sheet === "new-duel" && <NewDuel s={s} store={store} />}
    </div>
  );
}

function Group({ title, tone, children }: { title: string; tone?: "yours"; children: ReactNode }) {
  return (
    <section className={`pl-duel-group${tone ? " pl-duel-group--yours" : ""}`}>
      <h2 className="pl-h2">{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

function Row({ d, primary, onOpen }: { d: DuelGame; primary?: boolean; onOpen: () => void }) {
  const lead = d.you >= d.them ? "pl-up" : "pl-down";
  const action = d.status === "yourTurn" ? "Play" : d.status === "completed" || d.status === "expired" ? "Rematch" : null;
  return (
    <li>
      <button className={`pl-duel-row pl-duel-row--${d.status}`} data-bot={`duel-${d.id}`} onClick={onOpen} style={{ borderLeftColor: d.color }}>
        <span className="pl-duel-main">
          <span className="pl-duel-who">
            <b>{d.opponent}</b>
            <span>{d.opponentHome}</span>
          </span>
          <span className="pl-duel-last">{d.lastMove}</span>
          <span className="pl-duel-meta">
            <span className={lead}>
              You {d.you} · {d.opponent} {d.them}
            </span>
            <span>{ago(d.updatedAt)}</span>
          </span>
        </span>
        {d.lastWord && d.status !== "expired" && <TileWord word={d.lastWord} />}
        {action && <span className={`pl-duel-act${primary ? " pl-duel-act--primary" : ""}`}>{action}</span>}
      </button>
    </li>
  );
}

function Empty({ store }: { store: Store<S> }) {
  return (
    <div className="pl-empty">
      <TileWord word="HELLO" size="m" />
      <h2 className="pl-h2">No word games yet</h2>
      <p>Word Duel is a game for two, a move whenever you like. Nana plays most evenings.</p>
      <button className="pl-btn pl-btn--primary pl-wide" data-bot="start-nana" onClick={() => store.update((x) => ({ ...x, sheet: "new-duel" }))}>
        <span> Start a game with Nana</span>
      </button>
    </div>
  );
}
