// The TV is the family's channel. A game owns the picture while it's on; the channel only speaks
// in its gaps: continuity between segments, a squeezeback while a segment is saved, the ident on the
// cut, and a lower third for a few seconds after. Nothing ever sits over the middle of the picture.
import type { S } from "../state";
import { Continuity } from "./Continuity";
import { Squeezeback } from "./Squeezeback";
import { Ident } from "./Ident";
import { OnAir } from "./OnAir";

export function Tv({ s }: { s: S }) {
  if (s.tv === "off") return <div className="ch-tv ch-tv-off" />;
  if (s.tv === "continuity") return <Continuity s={s} />;
  if (s.cut === "saving") return <Squeezeback s={s} />;
  if (s.cut === "ident") return <Ident s={s} />;
  return <OnAir s={s} />;
}
