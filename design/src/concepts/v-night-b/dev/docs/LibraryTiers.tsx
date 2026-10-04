// The same game (Bake Shop) at Tier 0, 1 and 2, as the family's phone and iPads show it.
// Each column is what one more step of integration buys, in the console's own components.
import { COUCH, gameById } from "../../../../world";
import { C, L } from "../Code";
import type { DevPage } from "../pages";
import { JoinByName, KEEPS, LiveCard, Push, ResumeRow, Tile } from "../Payoff";
import { TierChip } from "../Shell";

const GAME = "bake-shop";
const TIERS: (0 | 1 | 2)[] = [0, 1, 2];
const ADDED: Record<0 | 1 | 2, string> = { 0: "a manifest", 1: "+ ?ogs token, OGS saves", 2: "+ one POST per change" };

function Cell({ tier, row }: { tier: 0 | 1 | 2; row: "home" | "library" | "kids" | "push" }) {
  const inst = COUCH.find((i) => i.gameId === GAME);
  const title = inst?.title ?? "";
  if (row === "library") return <Tile gameId={GAME} tier={tier} note={tier === 0 ? "Starts fresh each time" : title.split(" · ")[0]} />;
  if (row === "home") {
    if (tier === 0) return <Empty text="Not on Home. OGS has nothing to bring you back to." />;
    if (tier === 1) return <ResumeRow gameId={GAME} point="Day 4 · 3 of 5 orders" when="saved Tuesday" />;
    return <LiveCard gameId={GAME} badge="Paused Tuesday" title={title} detail="Mrs. Bear is waiting for a strawberry cupcake" seats={inst?.seats.flatMap((s) => s.personIds) ?? []} compact />;
  }
  if (row === "kids") {
    if (tier === 0) return <Empty text="Each iPad opens your start page. Your game asks who is who." />;
    return <JoinByName gameId={GAME} />;
  }
  if (tier < 2) return <Empty text="No pushes. Nothing changes between sittings." />;
  return <Push title="Bake Shop · Mrs. Bear is waiting" body="Day 4 is saved. Resume on the TV." when="Tue 6:41 pm" />;
}

const Empty = ({ text }: { text: string }) => <p className="dv-empty">{text}</p>;

const ROWS: { id: "home" | "library" | "kids" | "push"; label: string; sub: string }[] = [
  { id: "home", label: "Home", sub: "Jump back in" },
  { id: "library", label: "Library", sub: "The tile" },
  { id: "kids", label: "Kids' iPads", sub: "Joining" },
  { id: "push", label: "Grown-up phone", sub: "Locked" },
];

export function LibraryTiers({ go }: { go: (p: DevPage) => void }) {
  const g = gameById(GAME);
  return (
    <article className="dv-doc dv-doc--wide">
      <p className="dv-kicker">Guide · payoff</p>
      <h1 className="dv-h1">One game, three tiers</h1>
      <p className="dv-lede">
        <L>{g.name} as the Mumms see it: every difference comes from your manifest,</L>
        <L>your saves or your <C>POST</C>, never from OGS app code.</L>
      </p>
      <div className="dv-matrix" role="table" aria-label={`${g.name} at each tier`}>
        <div className="dv-matrix__row dv-matrix__row--head" role="row">
          <span role="columnheader" />
          {TIERS.map((t) => (
            <span key={t} role="columnheader" className="dv-matrix__col">
              <TierChip tier={t} />
              <b>{KEEPS[t]}</b>
              <span>You added {ADDED[t]}</span>
            </span>
          ))}
        </div>
        {ROWS.map((r) => (
          <div key={r.id} className={`dv-matrix__row dv-matrix__row--${r.id}`} role="row">
            <span role="rowheader" className="dv-matrix__label">
              <b>{r.label}</b>
              <span>{r.sub}</span>
            </span>
            {TIERS.map((t) => (
              <span key={t} role="cell" className="dv-matrix__cell">
                <Cell tier={t} row={r.id} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="dv-matrix__foot">
        <p className="dv-p">
          <L>A couch game never has a turn; a game that sets <C>turn</C> also lands in <b>Your turn</b>.</L>
        </p>
        <button className="dv-link" data-bot="to-console" onClick={() => go("console-empty")}>
          Register your game in the Console →
        </button>
      </div>
    </article>
  );
}
