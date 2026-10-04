// First run, once the phone has connected the living room TV: opening night. The library's posters
// already hang on the lobby wall (dim, waiting); above them the cast board fills in as setup happens
// on Jonathan's phone: each person as their sticker on a headshot card, each kid's iPad as it pairs.
// Before the TV is connected nothing of ours is on it (TvOff); nobody touches this.
import { GAMES, HOME } from "../../../world";
import { setupPeople, type S, type SetupStep } from "../state";
import { Check, TabletIcon } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import { LobbyWall, Marquee } from "./poster/parts";

/** The TV shows the welcome only between "connected" and the end of first run. */
export const showsWelcome = (s: S): boolean => s.firstRun && s.cast === "off" && s.setup.tv === "connected";

const LINES: Record<SetupStep, { kicker: string; title: string; sub: string }> = {
  welcome: { kicker: "Coming soon", title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  tv: { kicker: "Coming soon", title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  people: { kicker: "Casting", title: "Who plays here", sub: "Everyone picks a sticker on Jonathan's phone" },
  ipads: { kicker: "Rehearsal", title: "Pairing the kids' iPads", sub: "Paired once, each iPad follows tonight's game" },
  ready: { kicker: "Opening night", title: "The living room is ready", sub: "Tonight starts on Jonathan's phone" },
};

export function TvWelcome({ s }: { s: S }) {
  const people = setupPeople(s.setup);
  const line = LINES[s.setup.step];
  const ready = s.setup.step === "ready";
  const library = GAMES.filter((g) => g.art.tv).map((g) => ({ gameId: g.id, line: g.shape === "live" ? "Game nights" : "Ready" }));
  return (
    <div className={`pw-welcome ${ready ? "is-ready" : ""}`}>
      <Marquee>
        {line.kicker} <em>· {HOME.name}' living room</em>
      </Marquee>
      <section className="pw-welcome__head" key={s.setup.step}>
        <h1 className="pw-poster__title">{line.title}</h1>
        <p className="pw-poster__sub">{line.sub}</p>
      </section>
      {people.length > 0 && (
        <ul className="pw-cast">
          {people.map((p, i) => {
            const kid = p.band !== "grownup";
            const pairing = kid ? (s.setup.ipads[p.id] ?? "unpaired") : null;
            return (
              <li key={p.id} style={{ animationDelay: `${i * 90}ms` }}>
                <span className="pw-cast__sticker">
                  <Sticker person={p} size={150} />
                </span>
                <b>{p.name}</b>
                {kid && s.setup.step !== "people" && (
                  <span className={`pw-cast__device ${pairing === "paired" ? "is-paired" : pairing === "waiting" ? "is-waiting" : ""}`} aria-hidden>
                    <TabletIcon size={34} />
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
      <LobbyWall items={library} className="pw-welcome__wall" />
    </div>
  );
}
