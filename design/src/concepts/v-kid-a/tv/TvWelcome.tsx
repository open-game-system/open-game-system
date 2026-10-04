// First run, once the phone has connected the living room TV: a calm console welcome that mirrors
// setup as it happens on Jonathan's phone. Who's been added (as their stickers), and each kid's iPad
// as it pairs. Before the TV is connected nothing of ours is on it (TvOff); nobody touches this.
import { HOME } from "../../../world";
import { setupPeople, type S, type SetupStep } from "../state";
import { Check, TabletIcon } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import { PulseMark } from "./Motif";

/** The TV shows the welcome only between "connected" and the end of first run. */
export const showsWelcome = (s: S): boolean => s.firstRun && s.cast === "off" && s.setup.tv === "connected";

const LINES: Record<SetupStep, { title: string; sub: string }> = {
  welcome: { title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  tv: { title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  people: { title: "Who plays here", sub: "Everyone picks a sticker on Jonathan's phone" },
  ipads: { title: "Pairing the kids' iPads", sub: "Each iPad is paired once, then follows tonight's game" },
  ready: { title: "The living room is ready", sub: "Tonight starts on Jonathan's phone" },
};

export function TvWelcome({ s }: { s: S }) {
  const people = setupPeople(s.setup);
  const line = LINES[s.setup.step];
  return (
    <div className="ct-welcome">
      <div className="ct-welcome__glow" aria-hidden />
      <header className="ct-connecting__top">
        <PulseMark size={52} />
        <span>
          {HOME.name} · Living room
        </span>
      </header>
      <section className="ct-welcome__body">
        <h1 className="ct-connecting__line" key={s.setup.step}>
          {line.title}
        </h1>
        <p className="ct-connecting__sub" key={`${s.setup.step}-sub`}>
          {line.sub}
        </p>
        {people.length > 0 && (
          <ul className="ct-connecting__who ct-welcome__who">
            {people.map((p) => {
              const kid = p.band !== "grownup";
              const pairing = kid ? (s.setup.ipads[p.id] ?? "unpaired") : null;
              return (
                <li key={p.id}>
                  <span className="ct-welcome__sticker">
                    <Sticker person={p} size={180} />
                  </span>
                  <b>{p.name}</b>
                  {kid && s.setup.step !== "people" && (
                    <span className={`ct-welcome__device ${pairing === "paired" ? "is-paired" : pairing === "waiting" ? "is-waiting" : ""}`} aria-hidden>
                      <TabletIcon size={36} />
                      {pairing === "paired" && (
                        <i key="ok">
                          <Check size={22} />
                        </i>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
