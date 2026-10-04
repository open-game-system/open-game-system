// First run, once the phone has connected the living room TV: the plain living-room night (no game
// yet), the clock, one line that follows setup on Jonathan's phone, and stickers appearing low as
// people are added; a kid's sticker stays faded until their iPad is paired. Nobody touches this.
import { setupPeople, type S, type SetupStep } from "../state";
import { Ambient } from "./Ambient";

/** The TV shows the welcome only between "connected" and the end of first run. */
export const showsWelcome = (s: S): boolean => s.firstRun && s.cast === "off" && s.setup.tv === "connected";

const LINES: Record<SetupStep, { what: string; where: string }> = {
  welcome: { what: "Hello, living room", where: "the rest happens on Jonathan's phone" },
  tv: { what: "Hello, living room", where: "the rest happens on Jonathan's phone" },
  people: { what: "Who plays here", where: "stickers are picked on Jonathan's phone" },
  ipads: { what: "Pairing the kids' iPads", where: "one at a time, on Jonathan's phone" },
  ready: { what: "The living room is ready", where: "tonight starts on Jonathan's phone" },
};

export function TvWelcome({ s }: { s: S }) {
  const line = LINES[s.setup.step];
  const pairing = s.setup.step === "ipads" || s.setup.step === "ready";
  const seats = setupPeople(s.setup).map((person) => ({ person, lit: person.band === "grownup" || !pairing || s.setup.ipads[person.id] === "paired" }));
  return <Ambient gameId={null} what={line.what} where={line.where} seats={seats} />;
}
