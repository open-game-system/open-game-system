/**
 * Per-stream variants for measuring on a real TV without a new image: the view URL may carry
 * `ogsStream=` with comma-separated flags. `kbps<N>` caps the video bitrate (1000-8000; default 4000),
 * `scale<N>` renders the page at N device pixels per CSS pixel (1-2; default 1) and the capture
 * (fixed 1280x720) downscales it. Anything else is ignored.
 */
export function streamVariant(targetUrl: string): { maxKbps: number; scale: number } {
  let flags: string[] = [];
  try {
    flags = (new URL(targetUrl).searchParams.get("ogsStream") ?? "").split(",");
  } catch {
    flags = [];
  }
  const num = (prefix: string) => {
    const flag = flags.find((f) => f.startsWith(prefix));
    const n = flag ? Number(flag.slice(prefix.length)) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const kbps = num("kbps");
  const scale = num("scale");
  return {
    maxKbps: kbps !== null && kbps >= 1000 && kbps <= 8000 ? kbps : 4000,
    scale: scale !== null && scale >= 1 && scale <= 2 ? scale : 1,
  };
}
