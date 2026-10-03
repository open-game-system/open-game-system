// One duel: Nana's board. Tap rack tiles to lay TONE down from her T, then play. One primary action.
import type { Store } from "../../../harness/store";
import { NOW } from "../../../world";
import { StatusBar } from "../brand/PhoneTop";
import { go, type S } from "../state";
import { DOWN, PREMIUM, RACK, SCORE, SIZE, SLOTS, VALUE, WORD } from "./boardData";
import { ago } from "./time";

const PREMIUM_LABEL = { tw: "3W", dw: "2W", tl: "3L", dl: "2L", star: "" } as const;

export function DuelBoard({ s, store }: { s: S; store: Store<S> }) {
  const d = s.duels.find((x) => x.id === s.duelOpen);
  if (!d) return null;
  const placed = s.placed;
  const ready = placed.length === SLOTS.length;
  const at = (r: number, c: number) => {
    const t = DOWN.find((x) => x.r === r && x.c === c);
    if (t) return { ch: t.ch, cls: t.last ? "is-last" : "" };
    const k = SLOTS.findIndex((x) => x.r === r && x.c === c);
    const p = k >= 0 ? placed[k] : undefined;
    if (p) return { ch: p.charAt(0), cls: s.sent ? "is-mine" : "is-pending" };
    return null;
  };
  const play = () =>
    store.update((x) => ({
      ...x,
      sent: true,
      duels: x.duels.map((g) => (g.id === d.id ? { ...g, status: "waiting", you: g.you + SCORE, lastMove: `You played ${WORD} for ${SCORE}`, lastWord: WORD, updatedAt: NOW.toISOString() } : g)),
    }));
  return (
    <div className="ch-phone ch-wd ch-wd-game">
      <StatusBar dark />
      <header className="ch-wd-bar">
        <button className="ch-ghost" data-bot="back-list" onClick={() => go(store, "duel-list")}>
          <i className="ch-ico ch-ico-back" aria-hidden="true" />
          Your turn
        </button>
        <span className="ch-wd-title">Word Duel</span>
      </header>
      <div className="ch-wd-vs">
        <span className="ch-wd-side">
          <small>You</small>
          <b>{d.you}</b>
        </span>
        <span className="ch-wd-mid">
          {s.sent ? (
            <>
              <b>Nana's move</b>
              <small>sent {ago(NOW.toISOString())}</small>
            </>
          ) : (
            <>
              <b>Your move</b>
              <small>
                Nana played <em>QUILT</em> for 34 · {ago("2026-10-03T18:47:00-07:00")}
              </small>
            </>
          )}
        </span>
        <span className="ch-wd-side is-them">
          <small>Nana</small>
          <b>{d.them}</b>
          <i style={{ background: d.color }} aria-hidden="true" />
        </span>
      </div>
      <div className="ch-wd-board" role="grid" aria-label="Board">
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          const t = at(r, c);
          const prem = PREMIUM[`${r},${c}`];
          const slot = SLOTS.some((x) => x.r === r && x.c === c) && !t && !s.sent;
          return (
            <span key={i} className={`ch-cell${prem ? ` is-${prem}` : ""}${slot ? " is-slot" : ""}`}>
              {t ? (
                <span className={`ch-tile ${t.cls}`}>
                  <span>{t.ch}</span>
                </span>
              ) : (
                prem && <span className="ch-prem">{PREMIUM_LABEL[prem]}</span>
              )}
            </span>
          );
        })}
      </div>
      {s.sent ? (
        <div className="ch-wd-sent">
          <p>
            <b>
              {WORD} for {SCORE}, sent to Nana.
            </b>{" "}
            She gets a nudge on her phone; you'll get one when she plays.
          </p>
          <button className="ch-primary" data-bot="back-list-sent" onClick={() => go(store, "duel-list")}>
            <span>Back to your games</span>
          </button>
        </div>
      ) : (
        <div className="ch-wd-dock">
          <div className="ch-rack">
            {RACK.map((ch, i) => {
              const key = `${ch}${i}`;
              const used = placed.includes(key);
              return (
                <button key={key} className={`ch-tile ch-rack-tile${used ? " is-used" : ""}`} data-bot={`rack-${ch}`} disabled={used || ready} onClick={() => store.update((x) => ({ ...x, placed: [...x.placed, key] }))}>
                  {!used && (
                    <>
                      <span>{ch}</span>
                      <sub>
                        <span>{VALUE[ch] ?? 1}</span>
                      </sub>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="ch-wd-actions">
            <button className="ch-secondary" data-bot="recall" disabled={placed.length === 0} onClick={() => store.update((x) => ({ ...x, placed: [] }))}>
              <span>Recall</span>
            </button>
            <button className="ch-primary" data-bot="play" disabled={!ready} onClick={play}>
              <span>{ready ? `Play ${WORD} · ${SCORE}` : "Tap tiles to lay them down"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
