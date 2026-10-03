// Tier 2: one POST per instance change. Real example: Rocket Crew mission 6, paused for Bake Shop.
import { C, CodeCard } from "../Code";
import type { DevPage } from "../pages";
import { LiveCard, Push } from "../Payoff";
import { INSTANCE_POST, INSTANCE_WORKER, TURN_SNIPPET } from "../samples";
import { TierChip } from "../Shell";

const STATUSES: [string, string][] = [
  ["lobby", "Join"],
  ["active", "In progress"],
  ["suspended", "Paused · Resume"],
  ["waiting", "Your turn / waiting"],
  ["completed", "New badge"],
  ["expired", "Leaves Home"],
];

const TIMELINE: [string, string][] = [
  ["7:02 pm", "Mission 6 starts. Rocket Crew posts active."],
  ["7:14 pm", "Dad switches the TV to Bake Shop. Every device leaves."],
  ["7:14 pm", "The room is empty, so Rocket Crew posts suspended."],
];

export function Instances({ go }: { go: (p: DevPage) => void }) {
  return (
    <div className="dv-split">
      <article className="dv-doc">
        <p className="dv-kicker">
          <TierChip tier={2} size="sm" /> Live on Home
        </p>
        <h1 className="dv-h1">Instance reports</h1>
        <p className="dv-lede">
          Post the whole card whenever an instance changes. OGS draws it on Home, gathers <b>Your turn</b> across games and pushes grown-ups. You never send a notification.
        </p>

        <h2 className="dv-h2">When to post</h2>
        <ol className="dv-time">
          {TIMELINE.map(([t, what], i) => (
            <li key={i}>
              <span className="dv-time__t">{t}</span>
              <span>{what}</span>
            </li>
          ))}
        </ol>

        <h2 className="dv-h2">
          <C>status</C>, and what Home shows
        </h2>
        <dl className="dv-status">
          {STATUSES.map(([k, v]) => (
            <div key={k}>
              <dt>
                <C>{k}</C>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="dv-payoff dv-payoff--row dv-payoff--t2">
          <LiveCard gameId="rocket-crew" badge="Paused 7:14 pm" title="Mission 6 · Navigator rank" detail="Bake Shop is on now" seats={["dad", "juneau"]} />
          <div className="dv-payoff__stack">
            <p className="dv-p">
              Set <C>turn</C> and it joins <b>Your turn</b>, with one push:
            </p>
            <Push title="Word Duel · your move" body="Nana played QUILT for 34" when="6:47 pm" />
          </div>
        </div>
        <button className="dv-link" data-bot="next-casting" onClick={() => go("casting")}>
          Next: the TV page →
        </button>
      </article>

      <aside className="dv-codecol">
        <CodeCard title="Report an instance" code={INSTANCE_POST} lang="http" badge="New" />
        <CodeCard title="From your room, when it empties" code={INSTANCE_WORKER} lang="ts" />
        <CodeCard title="Whose turn" code={TURN_SNIPPET} lang="json" />
      </aside>
    </div>
  );
}
