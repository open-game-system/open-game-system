// First run: nobody yet. The empty quilt says what goes here: your household first.
import { person } from "../../../world";
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { StatusBar, TabBar } from "../ui/Chrome";
import { Patch } from "../ui/Patch";
import { tabTo } from "./PeopleHome";

function EmptyQuilt() {
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 54 + 2} y="2" width="50" height="50" rx="16" fill="none" stroke="#b8ad99" strokeWidth="2" strokeDasharray="4 5" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={i * 54 + 29} y="58" width="50" height="50" rx="16" fill="none" stroke="#d5ccbb" strokeWidth="2" strokeDasharray="4 5" />
      ))}
      <rect x="56" y="114" width="50" height="34" rx="14" fill="none" stroke="#e2d9c8" strokeWidth="2" strokeDasharray="4 5" />
    </svg>
  );
}

export function PeopleEmpty({ store }: { store: Store<S> }) {
  return (
    <div className="pf-phone">
      <StatusBar />
      <div className="pf-largetitle">
        <h1>People</h1>
      </div>
      <div className="pf-scroll pf-empty">
        <div style={{ position: "relative", width: 220, height: 150 }}>
          <EmptyQuilt />
          <span style={{ position: "absolute", left: 2, top: 2 }}>
            <Patch person={person("dad")} size={50} />
          </span>
        </div>
        <h2>Games are better with your people.</h2>
        <p>Start with who's on your couch. Each game then knows who's who, and every iPad follows along by name.</p>
        <p className="pf-empty-safe">Kids live only inside your household. Other homes see your household's name, never a child's name or picture.</p>
        <button className="pf-primary" data-bot="setup-household">
          <span>Set up our household</span>
        </button>
        <div className="pf-empty-or">
          <button className="pf-link" data-bot="join-code">
            Join a game night with a code
          </button>
          <button className="pf-link" data-bot="duel-someone">
            Start a Word Duel with someone
          </button>
        </div>
      </div>
      <TabBar current="people" onTab={(t) => tabTo(store, t)} />
    </div>
  );
}
