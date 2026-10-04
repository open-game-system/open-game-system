// Before tonight starts the living room TV isn't ours: nothing from OGS is on it. The moment the phone
// says Play on TV, the living room comes up: the lights come on, tonight's game is down off the shelf
// and open, and each person hops onto the couch as their device joins (grown-ups' phones first).
import { gameById, type Person } from "../../../world";
import { hereTonight, pointIn, type S } from "../state";
import { headlineNight } from "./GameNight";
import { Room, shelfGames } from "./Room";

export function TvOff() {
  return <div className="ct-off" aria-label="TV not cast" />;
}

/** Grown-ups' phones answer first, then the kids' iPads (the order devices really join in). */
const joinOrder = (p: Person): number => (p.band === "grownup" ? 0 : 1);

export function TvConnecting({ s }: { s: S }) {
  const gameId = s.onTv ?? shelfGames()[0] ?? null;
  const people = [...hereTonight(s)].sort((a, b) => joinOrder(a) - joinOrder(b));
  const names = people.map((p) => p.name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  return (
    <Room mode="connecting" focusId={gameId} tag={gameId ? pointIn(s, gameId) : undefined} seats={people.map((person) => ({ person, badge: "check" }))} night={headlineNight(s)}>
      <span className="rm-kicker">Lights on · starting</span>
      <h1>{gameId ? gameById(gameId).name : "Connecting"}</h1>
      {who && <p className="rm-note">{who} joining</p>}
    </Room>
  );
}
