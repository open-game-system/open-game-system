import type { S } from "../state";
import { Room } from "./room";
import { Connecting, Detail, DuelOnPhone, Idle, Night, Playing } from "./views";

export function Tv({ s }: { s: S }) {
  if (s.cast === "connecting") return <Connecting s={s} />;
  if (s.cast !== "live") return <Idle />;
  const v = s.view;
  if (v.kind === "detail") return <Detail s={s} gameId={v.gameId} />;
  if (v.kind === "night") return <Night s={s} />;
  if (v.kind === "game") return <Playing key={v.gameId} gameId={v.gameId} />;
  if (v.kind === "duel") return <DuelOnPhone s={s} duelId={v.duelId} />;
  return <Room s={s} />;
}
