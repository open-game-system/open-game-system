// After a move: what happened, and the next game that's waiting on you (one tap to it).
import type { Store } from "../../../harness/store";
import { nextLabel, nextTurn } from "../inbox";
import { openTurn } from "../phone/TurnRows";
import type { S } from "../state";
import { StatusBar } from "../ui/Brand";
import { Check } from "../ui/Icons";

export function DuelPlayed({ s, store }: { s: S; store: Store<S> }) {
  const d = s.duels.find((x) => x.id === s.duel.open);
  if (!d) return null;
  const next = nextTurn(s, d.id);
  const lead = d.you - d.them;
  return (
    <div className="wd wd--played">
      <StatusBar />
      <div className="wd-played">
        <span className="wd-played__check">
          <Check size={34} />
        </span>
        <h1>CRANE for 27</h1>
        <p className="wd-played__score">
          You {d.you} · {d.opponent} {d.them}
          <br />
          {lead > 0 ? `You lead by ${lead}.` : lead < 0 ? `${d.opponent} leads by ${-lead}.` : "All square."}
        </p>
        <p className="wd-played__then">Sent to {d.opponent}. We'll tell you when {d.opponent} moves.</p>
      </div>
      <div className="wd-played__next">
        {next && (
          <button className="cx-btn cx-btn--primary" data-bot="duel-next" onClick={() => store.update((x) => openTurn(x, next.target))}>
            <span>{nextLabel(next, s)}</span>
          </button>
        )}
        <button className="cx-btn cx-btn--ghost" data-bot="all-games" onClick={() => store.update((x) => ({ ...x, phone: "duels", duel: { open: null, placed: [], result: null } }))}>
          <span>All games</span>
        </button>
      </div>
    </div>
  );
}
