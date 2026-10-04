// Shared bits of first run: the three-stop path (TV · people · iPads) and the step frame.
import type { ReactNode } from "react";
import type { Store } from "../../../../harness/store";
import type { S, SetupStep } from "../../state";
import { setupTo } from "../../state";
import { HOME } from "../../../../world";
import { Chevron, TabletIcon, TvIcon } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";

const STOPS: { step: SetupStep; label: string; icon: ReactNode }[] = [
  { step: "tv", label: "TV", icon: <TvIcon size={20} /> },
  { step: "people", label: "People", icon: <Crest household={HOME} size={34} /> },
  { step: "ipads", label: "iPads", icon: <TabletIcon size={20} /> },
];
const ORDER: SetupStep[] = ["welcome", "tv", "people", "ipads", "ready"];

/** The setup's three stops on the dotted path; done stops are lit, the current one is ringed. */
export function SetupPath({ step }: { step: SetupStep }) {
  const at = ORDER.indexOf(step);
  return (
    <ol className="fr-path" aria-label="Setup steps">
      {STOPS.map((x) => {
        const i = ORDER.indexOf(x.step);
        const state = i < at ? "is-done" : i === at ? "is-now" : "";
        return (
          <li key={x.step} className={state}>
            <span className="fr-path__stop">{x.icon}</span>
            <span>{x.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One setup step: back, the path, a title, a lede, the body, and the dock with the next action. */
export function StepFrame({ s, store, back, title, lede, children, dock }: { s: S; store: Store<S>; back: SetupStep; title: string; lede: string; children: ReactNode; dock: ReactNode }) {
  return (
    <div className="fr">
      <div className="cx-topbar">
        <button className="cx-back" data-bot="setup-back" onClick={() => store.update((x) => setupTo(x, back))}>
          <Chevron size={20} dir="left" /> Back
        </button>
      </div>
      <div className="cx-scroll fr-scroll">
        <SetupPath step={s.setup.step} />
        <h1 className="cx-title">{title}</h1>
        <p className="cx-lede">{lede}</p>
        {children}
      </div>
      <div className="cx-dock fr-dock">{dock}</div>
    </div>
  );
}
