// The TV while the console menu is open on the phone: the shelf (Shelf swap, see TvShelf).
import type { S } from "../state";
import { TvShelf } from "./TvShelf";

export function TvPaused({ s, gameId }: { s: S; gameId: string }) {
  return <TvShelf s={s} from={gameId} to={null} phase="paused" />;
}
