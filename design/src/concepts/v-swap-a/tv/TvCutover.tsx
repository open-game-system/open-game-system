// The TV during a switch: the shelf swap (see TvShelf). The TV is the timeline the other devices mirror.
import type { S, Switching } from "../state";
import { TvShelf } from "./TvShelf";

export function TvCutover({ s, sw }: { s: S; sw: Switching; asleep: string[] }) {
  return <TvShelf s={s} from={sw.from} to={sw.to} phase={sw.phase} undo={sw.undo} />;
}
