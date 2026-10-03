import type { SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import type { S } from "./state";
import { Home } from "./phone/Home";
import { FirstRun } from "./phone/FirstRun";
import { Family } from "./phone/Family";
import { InGame } from "./phone/InGame";
import { DuelList } from "./duel/List";
import { DuelBoard } from "./duel/Board";
import { Tv } from "./tv/Tv";
import { Ipad } from "./ipad/Ipad";
import { Conductor } from "./Conductor";

export function Surface({ device, store, shot }: SurfaceProps<S>) {
  const s = useStore(store);
  if (device === "tv") return <Tv s={s} />;
  if (device === "ipad") return <Ipad s={s} />;
  return (
    <>
      {!shot && <Conductor s={s} store={store} />}
      <Phone s={s} store={store} />
    </>
  );
}

function Phone({ s, store }: { s: S; store: SurfaceProps<S>["store"] }) {
  switch (s.phone) {
    case "first-run":
      return <FirstRun s={s} store={store} />;
    case "family":
      return <Family s={s} store={store} />;
    case "game":
      return <InGame s={s} store={store} />;
    case "duels":
      return <DuelList s={s} store={store} />;
    case "duel":
      return <DuelBoard s={s} store={store} />;
    default:
      return <Home s={s} store={store} />;
  }
}
