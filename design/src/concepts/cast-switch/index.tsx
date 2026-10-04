// Direction "Switch home": cast first; the TV is a Switch-like console home (one big row of game tiles,
// a small system row, the household's stickers along the top); the phone is a Joy-Con-style remote.
import { useEffect } from "react";
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import { flows } from "./flows";
import { KidSurface } from "./kid";
import { PhoneSurface } from "./phone";
import { scenarios } from "./scenarios";
import type { S } from "./state";
import { TvSurface } from "./tv";

/** The phone drives the clock: connecting, a game's title card and a re-cast each settle on their own. */
function useSessionClock(store: SurfaceProps<S>["store"], on: boolean) {
  const s = useStore(store);
  const v = s.view;
  const key = `${s.cast}|${v.kind}|${v.kind === "game" ? v.phase + v.gameId : ""}`;
  useEffect(() => {
    if (!on) return;
    if (s.cast === "connecting") {
      const t = setTimeout(() => store.update((x) => ({ ...x, cast: "on", coach: true, view: { kind: "home" } })), 2200);
      return () => clearTimeout(t);
    }
    if (s.cast === "recasting") {
      const t = setTimeout(() => store.update((x) => ({ ...x, cast: "on" })), 2200);
      return () => clearTimeout(t);
    }
    if (s.cast === "on" && v.kind === "game" && v.phase === "starting") {
      const t = setTimeout(() => store.update((x) => (x.view.kind === "game" ? { ...x, view: { ...x.view, phase: "playing" }, savedNote: null } : x)), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, on]);
}

function Surface({ device, store, shot, seat }: SurfaceProps<S>) {
  useSessionClock(store, device === "phone" && !shot);
  const s = useStore(store);
  return (
    <div className={`sw sw--${device}`}>
      {device === "tv" ? <TvSurface store={store} /> : device === "ipad" ? <KidSurface store={store} seat={seat ?? s.kidSeat} /> : <PhoneSurface store={store} />}
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "cast-switch",
  name: "Cast first · Switch home",
  brief:
    "Cast first, then the TV is a Switch-like console home: one big row of game tiles (last played first, resume point under the focused one), a small system row, the household's stickers on top as the user picker. The phone is a Joy-Con-style remote (d-pad, A/B, Home, List) or a tile list that mirrors the TV row. Games run inside the launcher's one stream; Home suspends them.",
  css,
  Surface,
  scenarios,
  flows,
});
