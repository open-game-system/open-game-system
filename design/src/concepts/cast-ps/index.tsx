// "PS5 hub": cast first; the TV is a console launcher (icon row → the focused game's hub with
// activity cards); the phone is a glass touchpad remote; Home over a game raises a control centre.
import { useEffect } from "react";
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import phoneCss from "./phone.css?raw";
import kidCss from "./kid.css?raw";
import tvCss from "./tv.css?raw";
import sora from "./fonts/sora.woff2?url";
import hanken from "./fonts/hanken.woff2?url";
import { flows } from "./flows";
import { scenarios } from "./scenarios";
import type { S } from "./state";
import { TvSurface } from "./tv";
import { PhoneSurface } from "./phone";
import { KidSurface } from "./kid";

const fonts = `
@font-face { font-family: "CP Sora"; src: url(${sora}) format("woff2"); font-weight: 100 800; font-display: block; }
@font-face { font-family: "CP Hanken"; src: url(${hanken}) format("woff2"); font-weight: 100 900; font-display: block; }
`;

/** Timed beats of the session (the cast connecting, a game loading). Driven once, by the phone. */
function useBeats({ store, shot, device }: Pick<SurfaceProps<S>, "store" | "shot" | "device">, s: S) {
  const key = `${s.cast}:${s.tv.kind}`;
  useEffect(() => {
    if (shot || device !== "phone") return;
    const after = (ms: number, fn: (x: S) => S) => {
      const t = setTimeout(() => store.update(fn), ms);
      return () => clearTimeout(t);
    };
    if (s.cast === "connecting") return after(2200, (x) => (x.cast === "connecting" ? { ...x, cast: "on", tv: { kind: "launcher" }, fresh: true } : x));
    if (s.cast === "recasting") return after(2200, (x) => (x.cast === "recasting" ? { ...x, cast: "on" } : x));
    if (s.tv.kind === "switching") return after(2400, (x) => (x.tv.kind === "switching" ? { ...x, tv: { kind: "game", gameId: x.tv.to } } : x));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shot, device, store]);
}

function Surface({ device, store, shot, seat }: SurfaceProps<S>) {
  const s = useStore(store);
  useBeats({ store, shot, device }, s);
  if (device === "tv") return <TvSurface s={s} />;
  if (device === "ipad") return <KidSurface s={s} seat={seat ?? "juneau"} />;
  return <PhoneSurface s={s} store={store} />;
}

export const concept = defineConcept<S>({
  id: "cast-ps",
  name: "Cast-first · PS5 hub",
  brief:
    "Cast first, then the TV is a console: a row of game icons; focusing one turns the whole screen into that game's hub (its art, Continue/New, activity cards). The phone is a glass touchpad remote with Back and Home (or the same launcher as a list). In a game, Home raises a control centre over the suspended game to switch without leaving the stream; kid iPads follow by name.",
  css: fonts + css + tvCss + phoneCss + kidCss,
  Surface,
  scenarios,
  flows,
});
