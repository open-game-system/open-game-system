// "Netflix rows": cast first, then the TV is a Netflix / Apple TV-style launcher that hosts every
// game inside one stream. The phone browses the same rows (the TV follows) or is a Roku-style remote.
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import { KidSurface } from "./kid";
import { PhoneSurface } from "./phone";
import { flows, scenarios } from "./scenarios";
import type { S } from "./state";
import { TvSurface } from "./tv";

function Surface({ device, store, seat }: SurfaceProps<S>) {
  const s = useStore(store);
  return (
    <div className="cr" data-surface={device}>
      {device === "tv" ? <TvSurface s={s} /> : device === "ipad" ? <KidSurface s={s} seat={seat} /> : <PhoneSurface s={s} store={store} />}
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "cast-rows",
  name: "Netflix rows",
  brief:
    "Cast first. The TV becomes a calm, cinematic launcher: a full-bleed hero for the focused game above rows (Continue, Your turn, Couch games, Game nights, Library), and every game runs inside that one stream. The phone browses the same rows (touch focuses on the TV, a second touch plays) or flips to a Roku-style touchpad remote. Who's playing is asked once a night with the family's stickers; kid iPads follow by name.",
  css,
  Surface,
  scenarios,
  flows,
});
