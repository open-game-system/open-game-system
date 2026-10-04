/** The cut-over's geometry: the full-screen player laid onto a box on the 1920×1080 stage. Pure. */
const W = 1920;
const H = 1080;
const RADIUS = 28;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Frame {
  transform: string;
  clipPath: string;
}

/**
 * The player shrunk onto a rect of any shape: scaled uniformly to cover it, centred on it and
 * clipped to it, so the art keeps its proportions (a square icon shows the art's middle).
 */
export function boxFrame(r: Rect): Frame {
  const k = Math.max(r.w / W, r.h / H);
  const tx = r.x + r.w / 2 - (W * k) / 2;
  const ty = r.y + r.h / 2 - (H * k) / 2;
  const ix = (W - r.w / k) / 2;
  const iy = (H - r.h / k) / 2;
  return {
    transform: `translate(${tx}px, ${ty}px) scale(${k})`,
    clipPath: `inset(${iy}px ${ix}px round ${RADIUS / k}px)`,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The stage rect a frame shows: what the cut-over starts from or lands on. */
export function visibleRect(f: Frame): Rect {
  const t = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(f.transform);
  const c = /inset\(([-\d.e]+)px ([-\d.e]+)px/.exec(f.clipPath);
  const [tx, ty, k] = [Number(t?.[1]), Number(t?.[2]), Number(t?.[3])];
  const [iy, ix] = [Number(c?.[1]), Number(c?.[2])];
  return {
    x: round(tx + ix * k),
    y: round(ty + iy * k),
    w: round((W - 2 * ix) * k),
    h: round((H - 2 * iy) * k),
  };
}
