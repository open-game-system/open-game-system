// The swap as a checklist the grown-up can trust: saved → TV changed → each seat followed.
import type { ReactNode } from "react";
import { gameById, resumePoint, seatsFor } from "../household";
import { PlaceCard } from "../ui/PlaceCard";
import { Check, TvGlyph } from "../ui/Icons";
import type { S, SwitchStep } from "../state";

const ORDER: SwitchStep[] = ["saving", "cutover", "following"];
const at = (step: SwitchStep, of: SwitchStep) => ORDER.indexOf(step) - ORDER.indexOf(of);

export function SwitchProgress({ s }: { s: S }) {
  const t = s.tonight;
  if (t.kind !== "switching") return null;
  const from = gameById(t.from);
  const to = gameById(t.to);
  const fromPoint = resumePoint(t.from).toLowerCase();
  const toPoint = resumePoint(t.to).toLowerCase();
  return (
    <div className="pl-progress">
      <h2 className="pl-h2">
        {t.undo ? "Back to" : "Switching to"} {to.name}
      </h2>
      <p className="pl-sub">Nothing to do on the iPads. They follow on their own.</p>
      <ol className="pl-steps">
        <Step
          state={at(t.step, "saving") > 0 ? "done" : "doing"}
          lead={<img src={from.art.tv} alt="" />}
          doing={`Saving ${from.name} at ${fromPoint}`}
          done={`${from.name} saved at ${fromPoint}`}
        />
        <Step
          state={at(t.step, "cutover") > 0 ? "done" : at(t.step, "cutover") === 0 ? "doing" : "todo"}
          lead={<TvGlyph size={26} />}
          doing={`Living room TV changing to ${to.name}`}
          done={`${to.name} on the TV, ${toPoint}`}
          todo="Living room TV"
        />
      </ol>
      <div className="pl-progress-seats">
        {seatsFor(to).map((seat, i) => {
          const asleep = s.avaAsleep && seat.person.id === "ava";
          const kid = seat.person.band !== "grownup";
          const followed = at(t.step, "following") >= 0;
          const line = !kid ? (
            <span className="pl-seat-ok">
              <Check size={14} /> This phone
            </span>
          ) : asleep && followed ? (
            <span className="pl-seat-warn">Asleep · 9%</span>
          ) : followed ? (
            <span className="pl-seat-wait">Following…</span>
          ) : (
            <span className="pl-seat-wait">{seat.role}</span>
          );
          return (
            <PlaceCard
              key={seat.person.id}
              person={seat.person}
              size="s"
              line={line}
              state={asleep && followed ? "asleep" : followed ? "arriving" : "here"}
              delay={i * 140}
            />
          );
        })}
      </div>
    </div>
  );
}

function Step({ state, lead, doing, done, todo }: { state: "todo" | "doing" | "done"; lead: ReactNode; doing: string; done: string; todo?: string }) {
  return (
    <li className={`pl-step pl-step--${state}`}>
      <span className="pl-step-lead">{lead}</span>
      <span className="pl-step-text">{state === "done" ? done : state === "doing" ? doing : todo ?? doing}</span>
      <span className="pl-step-mark">{state === "done" ? <Check size={18} /> : state === "doing" ? <span className="pl-spin" /> : null}</span>
    </li>
  );
}
