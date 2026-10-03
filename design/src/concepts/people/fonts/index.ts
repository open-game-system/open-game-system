// Fonts ship with the concept (all SIL OFL) and are registered before first render, so
// document.fonts.ready waits for them and no shot ever shows a fallback face.
import fraunces from "./fraunces.woff2?url";
import instrument from "./instrument-sans.woff2?url";
import lilita from "./lilita-one.woff2?url";
import baloo from "./baloo2.woff2?url";

const FACES: { family: string; url: string; weight: string; extra?: FontFaceDescriptors }[] = [
  { family: "Fraunces", url: fraunces, weight: "400 700" },
  { family: "Instrument Sans", url: instrument, weight: "400 700" },
  { family: "Lilita One", url: lilita, weight: "400" },
  { family: "Baloo 2", url: baloo, weight: "500 800" },
];

export function registerFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  for (const f of FACES) {
    const face = new FontFace(f.family, `url(${f.url}) format("woff2")`, { weight: f.weight, display: "block" });
    document.fonts.add(face);
    face.load().catch(() => undefined);
  }
}
