import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { gameById } from "../../../world";
import { TvConnecting, TvOff } from "./TvCastState";
import { TvCutover } from "./TvCutover";
import { TvHome } from "./TvHome";
import { TvPlaying } from "./TvPlaying";

export function TvSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  return (
    <div className="tv">
      {s.cast === "off" ? (
        <TvOff />
      ) : s.cast === "connecting" ? (
        <TvConnecting gameName={s.onTv ? gameById(s.onTv).name : null} />
      ) : s.switching ? (
        <TvCutover key={`${s.switching.from}-${s.switching.to}`} sw={s.switching} asleep={s.asleep} />
      ) : s.onTv ? (
        <TvPlaying key={s.onTv} s={s} gameId={s.onTv} />
      ) : (
        <TvHome s={s} />
      )}
    </div>
  );
}
