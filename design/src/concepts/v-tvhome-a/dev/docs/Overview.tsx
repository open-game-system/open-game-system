// The one-page pitch: the promise, the three tiers as a ladder, the library as proof.
import { GAMES } from "../../../../world";
import { CodeLines } from "../Code";
import type { DevPage } from "../pages";
import { FreshRow, JoinByName, KEEPS, Push, ResumeRow, Tile, YourTurnRow } from "../Payoff";
import { TierChip } from "../Shell";

interface Rung {
  tier: 0 | 1 | 2;
  page: DevPage;
  add: string;
  code: string;
  lang: "json" | "http";
  cost: string;
}

const RUNGS: Rung[] = [
  {
    tier: 0,
    page: "manifest",
    add: "One JSON file",
    lang: "json",
    code: `{ "appId": "peekaboo-garden",
  "startUrl": "https://…/",
  "tvUrl": "https://…/tv",
  "roles": [ … ] }`,
    cost: "No code. About ten minutes.",
  },
  {
    tier: 1,
    page: "identity",
    add: "+ a token in, a save out",
    lang: "http",
    code: `startUrl?ogs=eyJhbGci…
GET /api/v1/saves/bake-shop
PUT /api/v1/saves/bake-shop`,
    cost: "Three fetches. No accounts, no database.",
  },
  {
    tier: 2,
    page: "instances",
    add: "+ one POST per change",
    lang: "http",
    code: `POST /api/v1/instances
{ "status": "suspended",
  "title": "Mission 6 · Navigator rank" }`,
    cost: "One call from your server. No push service.",
  },
];

function Sees({ tier }: { tier: 0 | 1 | 2 }) {
  if (tier === 0)
    return (
      <div className="dv-sees">
        <Tile gameId="peekaboo-garden" tier={0} />
        <FreshRow gameId="peekaboo-garden" />
      </div>
    );
  if (tier === 1)
    return (
      <div className="dv-sees">
        <ResumeRow gameId="bake-shop" point="Day 4 · 3 of 5 orders" when="paused Tuesday" />
        <JoinByName gameId="bake-shop" />
      </div>
    );
  return (
    <div className="dv-sees">
      <YourTurnRow />
      <Push title="Word Duel · your move" body="Nana played QUILT for 34" when="6:47 pm" />
    </div>
  );
}

export function Overview({ go }: { go: (p: DevPage) => void }) {
  return (
    <article className="dv-doc dv-doc--wide">
      <p className="dv-kicker">Overview</p>
      <h1 className="dv-h1">Bring your game to OGS</h1>
      <p className="dv-lede">
        Your game stays a web page on your own domain. Describe it in one JSON file and it is in the family's library, on their TV, tonight. Nothing in the OGS app changes for your game: each tier is config or a few HTTP calls.
      </p>

      <ol className="dv-ladder" aria-label="Integration tiers">
        {RUNGS.map((r) => (
          <li key={r.tier} className={`dv-rung dv-rung--${r.tier}`}>
            <div className="dv-rung__head">
              <TierChip tier={r.tier} />
              <h2>{KEEPS[r.tier]}</h2>
            </div>
            <p className="dv-rung__label">You add</p>
            <p className="dv-rung__add">{r.add}</p>
            <div className="dv-rung__code">
              <CodeLines code={r.code} lang={r.lang} />
            </div>
            <p className="dv-rung__cost">{r.cost}</p>
            <p className="dv-rung__label">The family sees</p>
            <Sees tier={r.tier} />
            <button className="dv-rung__go" data-bot={`rung-${r.tier}`} onClick={() => go(r.page)}>
              {r.tier === 0 ? "Start with the manifest" : `Add Tier ${r.tier}`}
              <span aria-hidden>→</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="dv-proof">
        <span className="dv-proof__h">In the library today</span>
        <ul>
          {GAMES.map((g) => (
            <li key={g.id}>
              <span>{g.name}</span>
              <TierChip tier={g.tier} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
