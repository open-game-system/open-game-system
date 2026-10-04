// Before tonight starts the living room TV isn't ours: nothing from OGS is on it. The moment the phone
// says Play on TV, the ambient night comes up from tonight's game (never a spinner on black): one
// line, and each person's sticker lights as their device arrives (phones first, then iPads).
import { gameById, type Person } from "../../../world";
import { hereTonight, pointIn, type S } from "../state";
import { Ambient, lowerFirst } from "./Ambient";

export function TvOff() {
  return <div className="ct-off" aria-label="TV not cast" />;
}

const joinOrder = (p: Person): number => (p.band === "grownup" ? 0 : 1);

export function TvConnecting({ s }: { s: S }) {
  const game = s.onTv ? gameById(s.onTv) : null;
  const people = [...hereTonight(s)].sort((a, b) => joinOrder(a) - joinOrder(b));
  const kids = people.filter((p) => p.band !== "grownup").map((p) => p.name);
  const joining = kids.length > 1 ? `${kids.slice(0, -1).join(", ")} and ${kids[kids.length - 1]} joining` : kids.length ? `${kids[0]} joining` : "joining";
  const what = game ? `${game.name} · ${lowerFirst(pointIn(s, game.id))}` : "Living room";
  return <Ambient gameId={game?.id ?? null} what={what} where={joining} seats={people.map((person, i) => ({ person, lit: false, joinAt: 400 + i * 550 }))} />;
}
