// The TV while the console menu is open on the phone: the game sinks back into its own night (the
// same ambient as the home) and says where it stopped. The next games live on the phone, not here.
import { gameById } from "../../../world";
import { hereTonight, pointIn, type S } from "../state";
import { Ambient, lowerFirst } from "./Ambient";

export function TvPaused({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const at = s.fresh[gameId] ? "paused, new game" : `paused at ${lowerFirst(pointIn(s, gameId))}`;
  return <Ambient gameId={gameId} what={`${g.name} · ${at}`} where="choose on Jonathan's phone" seats={hereTonight(s).map((person) => ({ person, lit: true }))} enter="settle" />;
}
