// Concept C, "Game Night Channel": tonight is a show on the family's own channel.
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import type { S } from "./state";
import { scenarios } from "./scenarios";
import { flows } from "./flows";
import { Phone } from "./phone/Phone";
import { Tv } from "./tv/Tv";
import { Ipad } from "./ipad/Ipad";

function Surface({ device, store, shot }: SurfaceProps<S>) {
  const s = useStore(store);
  return (
    <div className={`ch-root ch-${device}-root${shot ? " is-shot" : ""}`}>
      {device === "phone" && <Phone s={s} store={store} />}
      {device === "tv" && <Tv s={s} />}
      {device === "ipad" && <Ipad s={s} store={store} />}
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "channel",
  name: "C · Game Night Channel",
  brief: "Time-first: tonight is a programme on the family's own channel. On now, up next, later. The phone is the director's remote; the TV cuts between segments like a broadcast; kid iPads follow the cut.",
  Surface,
  css,
  scenarios,
  flows,
});
