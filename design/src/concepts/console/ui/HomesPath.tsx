// The homes at a game night, in seat order, on the console's dotted path. Each home is its crest
// (the grown-ups' stickers: what other homes are allowed to see) with its name; the home whose move
// it is stands on a lamp-lit disc. Words carry every state too ("to roll", "away"), so neither
// colour nor position stands alone, and the crests read in greyscale.
import type { Night, NightHome } from "../nights";
import { household, short, US } from "../nights";
import { Crest } from "./Sticker";

function stateWord(h: NightHome, turn: boolean, live: boolean): string {
  if (h.reply === "invited") return "Invited";
  if (h.reply === "declined") return "Can't make it";
  if (turn) return h.householdId === US ? "Your roll" : "To roll";
  if (!h.back) return "Away";
  return live ? "Waiting" : "Back";
}

function Token({ h, turn, live }: { h: NightHome; turn: boolean; live: boolean }) {
  const out = !h.back || (h.reply !== "in" && h.reply !== "host");
  return (
    <li className={`cx-path__home ${turn ? "is-turn" : ""} ${out ? "is-out" : ""}`}>
      <span className="cx-path__token">
        <Crest household={household(h.householdId)} size={46} shared dim={out} />
      </span>
      <b>{short(h.name)}</b>
      <span>{stateWord(h, turn, live)}</span>
    </li>
  );
}

export function HomesPath({ night }: { night: Night }) {
  const showTurn = night.status === "live" || night.status === "paused";
  return (
    <ol className="cx-path" aria-label="Homes in seat order">
      {night.homes.map((h) => (
        <Token key={h.householdId} h={h} turn={showTurn && night.turnOf === h.householdId} live={night.status === "live"} />
      ))}
    </ol>
  );
}
