import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { GameTvView } from "../games/registry";
import type { S } from "../state";
import { TvCutover } from "./TvCutover";
import { TvHome } from "./TvHome";

export function TvSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  return (
    <div className="tv">
      {s.switching ? <TvCutover key={`${s.switching.from}-${s.switching.to}`} sw={s.switching} asleep={s.asleep} /> : s.onTv ? <div className="tv-game" key={s.onTv}><GameTvView gameId={s.onTv} /></div> : <TvHome s={s} />}
    </div>
  );
}
