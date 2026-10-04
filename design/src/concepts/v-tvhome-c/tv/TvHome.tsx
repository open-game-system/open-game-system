// The TV when no game is running: quiet ambient. The focused couch game's art becomes a slow night,
// a large clock, one line saying what's up and where it's chosen, the family's stickers low.
// Nobody touches it: the phone moves the focus and the night crossfades to the next game's art.
import { gameById } from "../../../world";
import { couchShelf } from "../activities";
import { hereTonight, pointIn, type S } from "../state";
import { Ambient, lowerFirst } from "./Ambient";

export function TvHome({ s }: { s: S }) {
  const couch = couchShelf(s).filter((a) => gameById(a.gameId).shape === "couch" && gameById(a.gameId).art.tv);
  const focus = couch.find((a) => a.gameId === s.tvFocus) ?? couch[0];
  if (!focus) return null;
  const g = gameById(focus.gameId);
  return <Ambient gameId={g.id} what={`${g.name} · ${lowerFirst(pointIn(s, g.id))}`} where="choose on Jonathan's phone" seats={hereTonight(s).map((person) => ({ person, lit: true }))} />;
}
