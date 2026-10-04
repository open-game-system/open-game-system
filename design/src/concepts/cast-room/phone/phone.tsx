import { useCallback } from "react";
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { Dropped, OtherPhone, PreCast } from "./cast";
import { Controller } from "./controller";
import { DuelPlay } from "./duel";
import { GameController } from "./game";

export function Phone({ s, store, shot }: { s: S; store: Store<S>; shot: boolean }) {
  const act = useCallback((fn: (x: S) => S) => store.update(fn), [store]);
  let body;
  if (s.cast === "dropped") body = <Dropped s={s} act={act} />;
  else if (s.cast !== "live") body = <PreCast s={s} act={act} shot={shot} />;
  else if (s.phoneOf !== s.holder) body = <OtherPhone s={s} act={act} />;
  else if (s.view.kind === "game") body = <GameController s={s} gameId={s.view.gameId} act={act} />;
  else if (s.view.kind === "duel") body = <DuelPlay s={s} duelId={s.view.duelId} act={act} />;
  else body = <Controller s={s} act={act} />;
  return <div className="cr-phone">{body}</div>;
}
