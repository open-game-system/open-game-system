// A game's skin, derived only from its manifest (palette, art, look). Adding a game never adds a
// branch here: the type voice and corner shape are read from the words in `look`.
import type { CSSProperties } from "react";
import type { GameManifest } from "../../world";

declare module "react" {
  interface CSSProperties {
    [custom: `--${string}`]: string | number | undefined;
  }
}

export interface Skin {
  ground: string;
  ink: string;
  accent: string;
  accent2: string;
  /** Text colour that passes AA on `ground` (the manifest's ink, or a light/dark fallback). */
  onGround: string;
  onAccent: string;
  display: string;
  body: string;
  radius: number;
  /** Ground is dark: covers lay text in light tones. */
  dark: boolean;
  art: string;
  artAlt: string;
}

type Rgb = [number, number, number];

const hex = (h: string): Rgb => {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = (h: string) => {
  const [r, g, b] = hex(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export const contrast = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** The first candidate that reaches `need` against `bg`, else the best one. */
export const readableOn = (bg: string, candidates: string[], need = 4.5) => {
  const hit = candidates.find((c) => contrast(c, bg) >= need);
  if (hit) return hit;
  return [...candidates].sort((p, q) => contrast(q, bg) - contrast(p, bg))[0] ?? "#000000";
};

/** Type voice from the game's own words. Order matters: the most specific cue wins. */
const VOICES: { cue: RegExp; display: string; body: string; radius: number }[] = [
  { cue: /serif/i, display: "'Fraunces', Georgia, serif", body: "'Fraunces', Georgia, serif", radius: 6 },
  { cue: /arcade|chunky/i, display: "'Lilita One', 'Baloo 2', sans-serif", body: "'Baloo 2', sans-serif", radius: 22 },
  { cue: /plush|toy|clay|felt|soft/i, display: "'Baloo 2', sans-serif", body: "'Baloo 2', sans-serif", radius: 26 },
  { cue: /tile|word|letter/i, display: "'Libre Franklin', 'Helvetica Neue', sans-serif", body: "'Libre Franklin', 'Helvetica Neue', sans-serif", radius: 4 },
];
const FALLBACK_VOICE = { display: "'Familjen Grotesk', sans-serif", body: "'Familjen Grotesk', sans-serif", radius: 10 };

export function skinOf(g: GameManifest): Skin {
  const { ground, ink, accent, accent2 } = g.palette;
  const voice = VOICES.find((v) => v.cue.test(g.look)) ?? FALLBACK_VOICE;
  const dark = luminance(ground) < 0.2;
  const onGround = readableOn(ground, [ink, dark ? "#fffaf0" : "#16130f", dark ? "#16130f" : "#fffaf0"]);
  const onAccent = readableOn(accent, [ink, ground, "#16130f", "#ffffff"]);
  return {
    ground, ink, accent, accent2, onGround, onAccent, dark,
    display: voice.display,
    body: voice.body,
    radius: voice.radius,
    art: g.art.tv,
    artAlt: g.art.alt ?? g.art.tv,
  };
}

/** CSS custom properties for a subtree wearing a game's skin. */
export function skinVars(s: Skin): CSSProperties {
  return {
    "--g-ground": s.ground,
    "--g-ink": s.ink,
    "--g-accent": s.accent,
    "--g-accent2": s.accent2,
    "--g-on-ground": s.onGround,
    "--g-on-accent": s.onAccent,
    "--g-display": s.display,
    "--g-body": s.body,
    "--g-radius": `${s.radius}px`,
  };
}
