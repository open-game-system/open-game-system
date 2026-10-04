// First run, once the phone has connected the living room TV: the same living room, empty at first.
// The library is already on the shelf; each person hops onto the couch as they're added on
// Jonathan's phone, and each kid's iPad shows at their feet as it pairs. Nobody touches this.
import { setupPeople, type S, type SetupStep } from "../state";
import { Room, type CouchSeat } from "./Room";

/** The TV shows the welcome only between "connected" and the end of first run. */
export const showsWelcome = (s: S): boolean => s.firstRun && s.cast === "off" && s.setup.tv === "connected";

const LINES: Record<SetupStep, { kicker: string; title: string; sub: string }> = {
  welcome: { kicker: "Living room", title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  tv: { kicker: "Living room", title: "Hello, living room", sub: "Next on Jonathan's phone: who plays here" },
  people: { kicker: "Setting up", title: "Who plays here", sub: "Everyone picks a sticker on Jonathan's phone" },
  ipads: { kicker: "Setting up", title: "The kids' iPads", sub: "Paired once, each iPad follows tonight's game" },
  ready: { kicker: "All set", title: "The living room is ready", sub: "Tonight starts on Jonathan's phone" },
};

export function TvWelcome({ s }: { s: S }) {
  const line = LINES[s.setup.step];
  const seats: CouchSeat[] = setupPeople(s.setup).map((person) => {
    if (person.band === "grownup" || s.setup.step === "people") return { person, badge: "none" };
    const p = s.setup.ipads[person.id] ?? "unpaired";
    return { person, badge: p === "paired" ? "ipad-paired" : p === "waiting" ? "ipad-waiting" : "ipad-unpaired" };
  });
  return (
    <Room mode="welcome" focusId={null} seats={seats}>
      <div key={s.setup.step}>
        <span className="rm-kicker">{line.kicker}</span>
        <h1>{line.title}</h1>
        <p className="rm-note">{line.sub}</p>
      </div>
    </Room>
  );
}
