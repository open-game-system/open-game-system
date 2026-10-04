// Concept A: "Living Room Console". OGS is the family's game console: one library, TV-first.
// When a TV is cast, the TV is the home screen and the phone is the remote and controller.
import { defineConcept, type SurfaceProps } from "../../harness/types";
import css from "./concept.css?raw";
import devCss from "./dev.css?raw";
import kidCss from "./kid.css?raw";
import tvCss from "./tv.css?raw";
import { flows } from "./flows";
import { fontFaces } from "./fonts";
import { DevSurface } from "./dev/DevSurface";
import { EdgeLayer } from "./edge/EdgeLayer";
import edgeCss from "./edge.css?raw";
import { edgeFlows } from "./flows-edge";
import { edgeScenarios } from "./scenarios-edge";
import { KidSurface } from "./ipad/KidSurface";
import { PhoneSurface } from "./phone/PhoneSurface";
import { scenarios } from "./scenarios";
import { devScenarios } from "./scenarios-dev";
import { kidScenarios } from "./scenarios-kid";
import { tvScenarios } from "./scenarios-tv";
import type { S } from "./state";
import { TvSurface } from "./tv/TvSurface";

function Surface({ device, store, shot, seat }: SurfaceProps<S>) {
  return (
    <div className={`cx cx--${device}`}>
      <EdgeLayer device={device} store={store} seat={seat}>
        {device === "tv" ? <TvSurface store={store} /> : device === "ipad" ? <KidSurface store={store} seat={seat} /> : device === "desktop" ? <DevSurface store={store} /> : <PhoneSurface store={store} shot={shot} />}
      </EdgeLayer>
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "v-kid-c",
  name: "Kid C · Buddy",
  brief: "OGS is the family's console: one library for every game, TV-first. When a TV is cast it is the home screen; the phone is the remote and controller; paired kid iPads follow by name.",
  // concept.css is the phone/model owner's; tv.css and kid.css load after it and belong to those owners.
  css: fontFaces + css + tvCss + kidCss + devCss + edgeCss,
  Surface,
  // One scenario file per owner (phone/model, TV, kid) so parallel fix passes never collide.
  scenarios: [...scenarios, ...tvScenarios, ...kidScenarios, ...devScenarios, ...edgeScenarios],
  flows: [...flows, ...edgeFlows],
});
