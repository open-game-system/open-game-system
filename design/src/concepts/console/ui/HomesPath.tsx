// The homes at a game night, in seat order, on the console's dotted "follow" path. Each home is a
// seat token in its colour (a house, never a face) with its name; the home whose move it is wears
// the OGS ring. Words carry every state too ("to roll", "away"), so colour never stands alone.
import type { Night, NightHome } from "../nights";
import { short, US } from "../nights";

function House({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 11.2L12 4.5l8 6.7V19a1 1 0 01-1 1h-4.5v-5h-5v5H5a1 1 0 01-1-1z" fill="#fff" fillOpacity=".94" />
      <rect x="9.5" y="15" width="5" height="5" fill={color} />
    </svg>
  );
}

function Token({ h, turn, live }: { h: NightHome; turn: boolean; live: boolean }) {
  const state = h.reply === "invited" ? "Invited" : h.reply === "declined" ? "Declined" : turn ? (h.householdId === US ? "Your roll" : "To roll") : !h.back ? "Away" : live ? "Waiting" : "Back";
  return (
    <li className={`cx-path__home ${turn ? "is-turn" : ""} ${!h.back || h.reply !== "in" && h.reply !== "host" ? "is-out" : ""}`}>
      <span className="cx-path__token" style={{ background: h.color }}>
        <House color={h.color} />
      </span>
      <b>{short(h.name)}</b>
      <span>{state}</span>
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
