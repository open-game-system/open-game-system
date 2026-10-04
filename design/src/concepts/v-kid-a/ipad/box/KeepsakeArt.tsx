// The drawn keepsakes, each in its game's palette, chunky and toy-like (thick cream outline like a
// sticker, a soft highlight). No faces on objects.
import type { Keepsake } from "./keepsakes";

const OUT = "#fff6e0";

export function KeepsakeArt({ k }: { k: Keepsake }) {
  if (k.kind === "img" && k.src) return <img className="tb-keep__img" src={k.src} alt="" draggable={false} />;
  const [a = "#ffd23f", b = "#8fddbe"] = k.colors;
  return (
    <svg className="tb-keep__svg" viewBox="0 0 100 100" aria-hidden>
      {k.kind === "planet" && (
        <>
          <ellipse cx="50" cy="54" rx="46" ry="15" fill="none" stroke={OUT} strokeWidth="12" transform="rotate(-18 50 54)" />
          <circle cx="50" cy="50" r="28" fill={a} stroke={OUT} strokeWidth="5" />
          <path d="M26 44c10 4 34 6 48-2M28 60c12 3 30 3 44-4" stroke="#00000022" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M8 70 C 30 66, 70 46, 92 30" fill="none" stroke={b} strokeWidth="6" strokeLinecap="round" />
          <circle cx="40" cy="38" r="6" fill="#ffffff66" />
        </>
      )}
      {k.kind === "medal" && (
        <>
          <path d="M34 4h14l6 30h-14zM66 4H52l-6 30h14z" fill={a} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="50" cy="60" r="32" fill={b} stroke={OUT} strokeWidth="5" />
          <path d="M50 38l6.4 13 14.3 2-10.4 10 2.5 14.2L50 70.5l-12.8 6.7 2.5-14.2-10.4-10 14.3-2z" fill="#fff6e0" />
        </>
      )}
      {k.kind === "cupcake" && (
        <>
          <path d="M22 54h56l-8 38H30z" fill={b} stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
          <path d="M36 56l3 34M50 56v34M64 56l-3 34" stroke="#00000022" strokeWidth="4" />
          <path d="M16 56c-4-14 8-22 16-20 0-12 14-20 24-12 10-6 24 2 22 14 10 2 12 12 6 18z" fill={a} stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="54" cy="16" r="9" fill="#e5484d" stroke={OUT} strokeWidth="4" />
          <path d="M30 44l6-3M48 36l7 1M64 46l5 3M40 50l5 1" stroke="#fff6e0" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {k.kind === "donut" && (
        <>
          <circle cx="50" cy="52" r="40" fill="#d9a066" stroke={OUT} strokeWidth="5" />
          <path d="M14 50c2-20 18-34 36-34s34 14 36 34c-6 8-10 2-16 8s-10-4-18 2-12-4-20 2-12-6-18-12z" fill={a} />
          <circle cx="50" cy="52" r="12" fill="#5a3a24" stroke={OUT} strokeWidth="5" />
          <path d="M28 32l6 4M64 28l6-3M72 46l6 2M36 66l-5 3M60 70l6 2M24 50l2 6" stroke={b} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {k.kind === "flower" && (
        <>
          <path d="M50 60v36" stroke="#3f7d2b" strokeWidth="7" strokeLinecap="round" />
          {[0, 60, 120, 180, 240, 300].map((d) => (
            <ellipse key={d} cx="50" cy="22" rx="14" ry="20" fill={a} stroke={OUT} strokeWidth="4" transform={`rotate(${d} 50 44)`} />
          ))}
          <circle cx="50" cy="44" r="14" fill={b} stroke={OUT} strokeWidth="4" />
        </>
      )}
      {k.kind === "leaf" && (
        <>
          <path d="M14 86C10 40 40 10 90 10c2 46-26 80-76 76z" fill="#6fbf4a" stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
          <path d="M18 82C40 60 60 38 80 20M40 62l-4-16M56 46l12 0" stroke="#3f7d2b" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      )}
      {k.kind === "moon" && (
        <>
          <path d="M62 10a40 40 0 1 0 28 56A32 32 0 0 1 62 10z" fill={a} stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="36" cy="44" r="5" fill="#00000018" />
          <circle cx="46" cy="70" r="7" fill="#00000018" />
        </>
      )}
      {k.kind === "feather" && (
        <>
          <path d="M20 92C24 56 46 18 86 8c4 34-20 70-58 80z" fill={b} stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
          <path d="M20 92C40 66 58 40 80 16M44 66l-14-6M54 52l-12-8M64 38l-10-10" stroke="#fff6e0aa" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}
