// The TV: nobody touches it. Between games it's the family's ambient screen; in a game, the game
// owns every pixel; during a swap, Porchlight's cut-over.
import type { S } from "../state";
import { gameById } from "../household";
import { Ambient } from "./Ambient";
import { Cutover } from "./Cutover";

export function Tv({ s }: { s: S }) {
  const t = s.tonight;
  if (t.kind === "idle") return <Ambient clock={s.clock} />;
  if (t.kind === "switching") return <Cutover s={s} />;
  const g = gameById(t.gameId);
  return (
    <div className="pl-tv pl-tv--game" key={t.gameId}>
      <img className="pl-tv-full" src={g.art.tv} alt="" />
    </div>
  );
}
