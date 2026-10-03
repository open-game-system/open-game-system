// Concept A: "Living Room Console". OGS is the family's game console: one library, TV-first.
// When a TV is cast, the TV is the home screen and the phone is the remote and controller.
import { defineConcept, type SurfaceProps } from "../../harness/types";
import css from "./concept.css?raw";
import { flows } from "./flows";
import { fontFaces } from "./fonts";
import { KidSurface } from "./ipad/KidSurface";
import { PhoneSurface } from "./phone/PhoneSurface";
import { scenarios } from "./scenarios";
import type { S } from "./state";
import { TvSurface } from "./tv/TvSurface";

function Surface({ device, store, shot }: SurfaceProps<S>) {
  return (
    <div className={`cx cx--${device}`}>
      {device === "tv" ? <TvSurface store={store} /> : device === "ipad" ? <KidSurface store={store} /> : <PhoneSurface store={store} shot={shot} />}
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "console",
  name: "A · Living Room Console",
  brief: "OGS is the family's console: one library for every game, TV-first. When a TV is cast it is the home screen; the phone is the remote and controller; paired kid iPads follow by name.",
  css: fontFaces + css,
  Surface,
  scenarios,
  flows,
});
