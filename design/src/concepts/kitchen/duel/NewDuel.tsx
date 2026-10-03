// New game: one game per opponent, so people you're already playing say so instead of offering
// a second board.
import type { Store } from "../../../harness/store";
import { HOUSEHOLDS } from "../../../world";
import type { S } from "../state";

export function NewDuel({ s, store }: { s: S; store: Store<S> }) {
  const playing = new Set(s.duels.filter((d) => d.status === "yourTurn" || d.status === "waiting").map((d) => d.opponent));
  const grownups = HOUSEHOLDS.flatMap((h) => h.people.filter((p) => p.band === "grownup" && p.id !== "dad").map((p) => ({ p, h })));
  const close = () => store.update((x) => ({ ...x, sheet: null }));
  return (
    <div className="pl-sheet-wrap">
      <button className="pl-scrim" aria-label="Close" data-bot="close-sheet" onClick={close} />
      <div className="pl-sheet" role="dialog" aria-label="New game">
        <span className="pl-grabber" />
        <h2 className="pl-h2 pl-sheet-title">New game with…</h2>
        <p className="pl-sheet-note">Grown-ups only. Word Duel never sends anything to the kids' iPads.</p>
        <ul className="pl-people">
          {grownups.map(({ p, h }) => {
            const busy = playing.has(p.name);
            return (
              <li key={p.id} style={{ borderLeftColor: p.color }}>
                <span>
                  <b>{p.name}</b>
                  <span>
                    {h.name} · {h.city}
                  </span>
                </span>
                {busy ? (
                  <span className="pl-people-busy">Playing now</span>
                ) : (
                  <button className="pl-btn pl-btn--secondary pl-btn--sm" data-bot={`start-${p.id}`} onClick={close}>
                    Start
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button className="pl-btn pl-btn--primary pl-wide" data-bot="invite-link" onClick={close}>
          <span>Invite someone with a link</span>
        </button>
      </div>
    </div>
  );
}
