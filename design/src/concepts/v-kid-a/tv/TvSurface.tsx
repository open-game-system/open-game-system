import { useRef } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { TvConnecting, TvOff } from "./TvCastState";
import { TvCutover } from "./TvCutover";
import { TvHome } from "./TvHome";
import { TvPlaying } from "./TvPlaying";
import { showsWelcome, TvWelcome } from "./TvWelcome";

export function TvSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  // The stream just came up from the casting moment: the game lands like a cut ("Now playing" strip
  // that collapses into the chip). Remembered per mount; a shot never sees the connecting frame.
  const wasConnecting = useRef(false);
  const arrived = useRef<string | null>(null);
  if (s.cast === "connecting") wasConnecting.current = true;
  else if (wasConnecting.current && s.onTv) {
    arrived.current = s.onTv;
    wasConnecting.current = false;
  }
  return (
    <div className="tv">
      {showsWelcome(s) ? (
        <TvWelcome s={s} />
      ) : s.cast === "off" ? (
        <TvOff />
      ) : s.cast === "connecting" ? (
        <TvConnecting s={s} />
      ) : s.switching ? (
        <TvCutover key={`${s.switching.from}-${s.switching.to}`} s={s} sw={s.switching} asleep={s.asleep} />
      ) : s.onTv ? (
        <TvPlaying key={s.onTv} s={s} gameId={s.onTv} arrived={arrived.current === s.onTv} />
      ) : (
        <TvHome s={s} />
      )}
    </div>
  );
}
