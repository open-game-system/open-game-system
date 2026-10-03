// While the channel cuts: three plain steps (saved, on the TV, iPads following). Nothing to tap.
import { HOME } from "../../../world";
import { StatusBar } from "../brand/PhoneTop";
import { Bars } from "../brand/Mark";
import { CHANNEL, RUNNING_ORDER, segment } from "../programme";
import type { S } from "../state";

type StepState = "done" | "doing" | "todo";

export function CutProgress({ s }: { s: S }) {
  const cut = s.cut;
  const fromId = s.prev ?? "rocket-crew";
  const from = segment(fromId);
  const to = segment(s.next);
  const order: Record<string, number> = { saving: 0, ident: 1, following: 2 };
  const at = cut ? (order[cut] ?? 0) : 3;
  const st = (i: number): StepState => (at > i ? "done" : at === i ? "doing" : "todo");
  const kids = HOME.devices.filter((d) => d.kind === "ipad");
  return (
    <div className="ch-phone ch-cutting">
      <StatusBar dark />
      <div className="ch-cut-hero">
        <img src={to.game.art.tv} alt="" />
        <div className="ch-cut-hero-lt">
          <Bars height={22} width={6} gap={3} live />
          <span className="ch-cut-label"><span>Cutting to</span></span>
          <h1>{to.game.name}</h1>
        </div>
      </div>
      <ol className="ch-steps">
        <li className={`is-${st(0)}`}>
          <i aria-hidden="true" />
          <span>
            <b>{st(0) === "doing" ? `Saving ${from.game.name}` : `${from.game.name} saved`}</b>
            <small>Resumes at {from.instance.title.split(" · ")[0]}, exactly as it was</small>
          </span>
        </li>
        <li className={`is-${st(1)}`}>
          <i aria-hidden="true" />
          <span>
            <b>On the {CHANNEL.tv}</b>
            <small>Same cast, new segment. Nothing to reconnect</small>
          </span>
        </li>
        <li className={`is-${st(2)}`}>
          <i aria-hidden="true" />
          <span>
            <b>iPads following</b>
            <span className="ch-follow">
              {kids.map((d) => {
                const p = HOME.people.find((x) => x.id === d.personId);
                const asleep = d.personId === "ava" && s.avaAsleep && at >= 2;
                return (
                  <span key={d.id} className={`ch-follow-dev${asleep ? " is-asleep" : at > 2 || (at === 2 && !asleep) ? " is-in" : ""}`}>
                    <i style={{ background: p?.color }} aria-hidden="true" />
                    {d.name}
                    {asleep && <em> · asleep, 9%</em>}
                  </span>
                );
              })}
            </span>
          </span>
        </li>
      </ol>
      <div className="ch-cut-rundown">
        <h2 className="ch-kicker">Running order</h2>
        <ol>
          {RUNNING_ORDER.map((id) => {
            const g = segment(id);
            const state = id === to.game.id ? "is-next" : id === from.game.id ? "is-saved" : "";
            return (
              <li key={id} className={state}>
                <time>{g.slot}</time>
                <span>{g.game.name}</span>
                <em>{state === "is-next" ? "Now" : state === "is-saved" ? `Saved · ${g.instance.title.split(" · ")[0]}` : ""}</em>
              </li>
            );
          })}
          <li>
            <time>8:00</time>
            <span>Hearthisle game night</span>
            <em />
          </li>
        </ol>
      </div>
    </div>
  );
}
