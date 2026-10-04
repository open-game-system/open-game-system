import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import tvCss from "./tv.css?raw";
import phoneCss from "./phone.css?raw";
import kidCss from "./kid.css?raw";
import { type S } from "./state";
import { Tv } from "./tv/tv";
import { Phone } from "./phone/phone";
import { Kid } from "./ipad/kid";
import { FLOWS } from "./flows";
import { SCENARIOS } from "./scenarios";

function Surface({ device, store, shot, seat }: SurfaceProps<S>) {
  const s = useStore(store);
  if (device === "tv")
    return (
      <div className="cr cr-tv">
        <Tv s={s} />
      </div>
    );
  if (device === "ipad")
    return (
      <div className="cr cr-ipad">
        <Kid s={s} seat={seat ?? "juneau"} />
      </div>
    );
  return (
    <div className="cr">
      <Phone s={s} store={store} shot={shot} />
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "cast-room",
  name: "Our living room",
  brief:
    "Cast first: the TV becomes the family's own living room (games as boxes on a shelf, Word Duel turns pinned to the cork board, game night through the window, the family on the couch). The phone holds the room in miniature on top and a big remote below; games open inside the one cast and fold back into their box on Home.",
  css: css + tvCss + phoneCss + kidCss,
  Surface,
  scenarios: SCENARIOS,
  flows: FLOWS,
});
