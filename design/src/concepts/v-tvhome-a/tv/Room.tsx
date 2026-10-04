// "Living-room diorama": every between-game state on the TV is the same painted-paper living room at
// night. The couch games stand as boxes on the shelf (the focused one is down, open and lit, its
// resume point on a tag); the family's stickers sit on the couch (who's here tonight); the clock is
// on the wall; tonight's game night is the window, the other homes' crests in the lit houses across
// the way. States change the room, not the layout: the lamp dims on pause, boxes swap on the shelf,
// people hop onto the couch as their devices join. Nobody touches it.
import type { CSSProperties, ReactNode } from "react";
import { GAMES, HOME, gameById, type Person } from "../../../world";
import { household, short, US, type Night } from "../nights";
import { Mark } from "../ui/Brand";
import { Check, Moon, TabletIcon } from "../ui/Icons";
import { Crest, Sticker } from "../ui/Sticker";
import { TvArt } from "./TvArt";

export type RoomMode = "home" | "paused" | "connecting" | "welcome";

/** A person on the couch, and what the badge at their feet says. */
export interface CouchSeat {
  person: Person;
  badge: "none" | "check" | "asleep" | "ipad-waiting" | "ipad-paired" | "ipad-unpaired";
}

/** The couch games with art, in the library's own order: the shelf never reshuffles between states. */
export const shelfGames = (): string[] => GAMES.filter((g) => g.shape === "couch" && g.art.tv).map((g) => g.id);

export function Room({
  mode,
  focusId,
  tag,
  seats,
  night,
  children,
}: {
  mode: RoomMode;
  focusId: string | null;
  /** The note tucked in the open box: where the game picks up ("Mission 6", "New game"). */
  tag?: string;
  seats: CouchSeat[];
  night?: Night;
  children: ReactNode;
}) {
  return (
    <div className={`rm rm--${mode}`}>
      <Backdrop />
      <Window night={night} />
      <WallClock />
      <div className="rm-dim" aria-hidden />
      <span className="rm-sign">
        <Mark size={34} />
        {HOME.name}
      </span>
      <Shelf focusId={focusId} tag={tag} paused={mode === "paused"} />
      <Couch seats={seats} stagger={mode === "connecting" || mode === "welcome"} />
      <section className="rm-text">{children}</section>
      <Grain />
    </div>
  );
}

// ---- the room's paper architecture (one SVG, painted-paper edges) ----

function Backdrop() {
  return (
    <svg className="rm-back" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden>
      <defs>
        <filter id="rm-cut" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#07061a" floodOpacity="0.45" />
        </filter>
        <linearGradient id="rm-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#221d45" />
          <stop offset="1" stopColor="#372a57" />
        </linearGradient>
        <linearGradient id="rm-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b3127" />
          <stop offset="1" stopColor="#24170f" />
        </linearGradient>
        <radialGradient id="rm-lampglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf8a" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ff9d5c" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ff9d5c" stopOpacity="0" />
        </radialGradient>
        <pattern id="rm-paper" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M32 18 l6 14 -6 14 -6 -14z" fill="#ffffff" opacity="0.035" />
        </pattern>
      </defs>
      <rect width="1920" height="820" fill="url(#rm-wall)" />
      <rect width="1920" height="820" fill="url(#rm-paper)" />
      <rect y="800" width="1920" height="280" fill="url(#rm-floor)" />
      <g stroke="#140c08" strokeOpacity="0.35" strokeWidth="3">
        <path d="M0 860 H1920 M0 930 H1920 M0 1010 H1920" />
      </g>
      <rect y="790" width="1920" height="22" fill="#1a1530" />
      {/* the rug: its border is the console's dotted follow path */}
      <ellipse cx="580" cy="1005" rx="560" ry="66" fill="#6f4130" filter="url(#rm-cut)" />
      <ellipse cx="580" cy="1005" rx="510" ry="46" fill="none" stroke="#f3e2c4" strokeOpacity="0.55" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 20" />
      {/* the shelf */}
      <g filter="url(#rm-cut)">
        <rect x="610" y="574" width="1010" height="30" rx="4" fill="#9a643f" />
        <rect x="610" y="574" width="1010" height="8" rx="3" fill="#c48a5c" />
        <path d="M680 604 h26 l-26 46z M1524 604 h26 l0 46z" fill="#7a4b2e" />
      </g>
      {/* the side table and its lamp */}
      <g className="rm-lamp">
        <circle className="rm-lamp__glow" cx="1100" cy="720" r="420" fill="url(#rm-lampglow)" />
        <g filter="url(#rm-cut)">
          <rect x="1050" y="820" width="104" height="16" rx="4" fill="#8a5a3a" />
          <rect x="1062" y="836" width="12" height="150" fill="#5e3b26" />
          <rect x="1130" y="836" width="12" height="150" fill="#5e3b26" />
          <path d="M1092 820 q-18 -40 10 -70 q28 30 10 70z" fill="#2c4f6b" />
          <rect x="1099" y="700" width="6" height="56" fill="#1d1730" />
          <path className="rm-lamp__shade" d="M1058 640 H1146 L1170 712 H1034 Z" />
        </g>
      </g>
    </svg>
  );
}

// ---- the window: tonight's game night, the other homes lit across the way ----

function Window({ night }: { night?: Night }) {
  const others = night ? night.homes.filter((h) => h.householdId !== US && h.reply !== "declined") : [];
  return (
    <div className="rm-window">
      <svg width="520" height="440" viewBox="0 0 520 440" aria-hidden className="rm-window__art">
        <defs>
          <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1433" />
            <stop offset="1" stopColor="#24346b" />
          </linearGradient>
          <clipPath id="rm-pane">
            <rect x="60" y="34" width="400" height="346" rx="6" />
          </clipPath>
        </defs>
        <g filter="url(#rm-cut)">
          <rect x="40" y="14" width="440" height="386" rx="10" fill="#efe2c8" />
        </g>
        <g clipPath="url(#rm-pane)">
          <rect x="60" y="34" width="400" height="346" fill="url(#rm-sky)" />
          {[
            [110, 80],
            [180, 130],
            [250, 66],
            [330, 120],
            [140, 190],
            [300, 200],
            [400, 230],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#fff4d8" opacity="0.8" />
          ))}
          <circle cx="398" cy="96" r="30" fill="#fbefd5" />
          <circle cx="412" cy="86" r="26" fill="#14204a" />
          <path d="M60 330 Q160 282 260 316 T460 300 V380 H60Z" fill="#1a2a4c" />
          {/* two houses across the way; their lit windows hold the other homes' crests */}
          <path d="M96 380 V300 L156 256 L216 300 V380Z" fill="#30264f" />
          <path d="M290 380 V292 L356 244 L422 292 V380Z" fill="#30264f" />
          <rect x="116" y="298" width="80" height="70" rx="8" className={night ? "rm-lit" : "rm-lit rm-lit--plain"} />
          <rect x="316" y="290" width="80" height="70" rx="8" className={night ? "rm-lit" : "rm-lit rm-lit--plain"} />
        </g>
        <rect x="56" y="196" width="408" height="10" fill="#efe2c8" />
        <rect x="24" y="398" width="472" height="20" rx="4" fill="#e1cfac" />
        {/* curtains */}
        <path d="M0 0 H62 Q54 200 80 430 H6 Q22 210 0 0Z" fill="#8c3f52" filter="url(#rm-cut)" />
        <path d="M520 0 H458 Q466 200 440 430 H514 Q498 210 520 0Z" fill="#8c3f52" filter="url(#rm-cut)" />
      </svg>
      {others.slice(0, 2).map((h, i) => (
        <span key={h.householdId} className={`rm-window__crest rm-window__crest--${i}`}>
          <Crest household={household(h.householdId)} size={66} shared />
        </span>
      ))}
      {night && <NightCaption night={night} names={others.map((h) => short(h.name))} />}
    </div>
  );
}

function NightCaption({ night, names }: { night: Night; names: string[] }) {
  const when = night.status === "live" ? "Game night · on now" : night.when ? `Game night ${night.when.replace(/^Tonight /, "")}` : "Game night";
  return (
    <p className="rm-window__caption">
      <span className="rm-kicker">{when}</span>
      <span>
        <b>{gameById(night.gameId).name}</b> with {names.join(" and ")}
      </span>
      {night.status === "paused" && <span className="rm-quiet">Paused at turn {night.turn}</span>}
    </p>
  );
}

// ---- the wall clock (7:10, Friday) ----

function WallClock() {
  const hour = (7 + 10 / 60) * 30;
  const minute = 10 * 6;
  return (
    <div className="rm-clock">
      <svg width="200" height="200" viewBox="-100 -100 200 200" aria-hidden>
        <g filter="url(#rm-cut)">
          <circle r="92" fill="#c9a46a" />
          <circle r="80" fill="#f3e7cf" />
        </g>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="-3" y="-72" width="6" height={i % 3 === 0 ? 16 : 9} rx="3" fill="#3a2b55" transform={`rotate(${i * 30})`} />
        ))}
        <rect x="-5" y="-44" width="10" height="50" rx="5" fill="#2a2148" transform={`rotate(${hour})`} />
        <rect x="-3.5" y="-64" width="7" height="70" rx="3.5" fill="#2a2148" transform={`rotate(${minute})`} />
        <circle r="8" fill="#c8412f" />
      </svg>
      <span className="rm-clock__time">
        <b>7:10</b> Friday
      </span>
    </div>
  );
}

// ---- the shelf: spines out, the focused game down, open and lit ----

function Shelf({ focusId, tag, paused }: { focusId: string | null; tag?: string; paused: boolean }) {
  const ids = shelfGames();
  return (
    <div className="rm-shelf">
      {ids.map((id, i) =>
        id === focusId ? (
          <OpenBox key={`open-${id}`} gameId={id} tag={tag} paused={paused} />
        ) : (
          <Spine key={id} gameId={id} lean={i === ids.length - 1 && focusId !== id} />
        ),
      )}
    </div>
  );
}

function Spine({ gameId, lean }: { gameId: string; lean: boolean }) {
  const g = gameById(gameId);
  const style: CSSProperties = { background: g.palette.ground, color: g.palette.ink, borderColor: g.palette.accent };
  return (
    <span className={`rm-spine ${lean ? "is-lean" : ""}`} style={style}>
      <span className="rm-spine__art">
        <TvArt gameId={gameId} />
      </span>
      <span className="rm-spine__name">{g.name}</span>
    </span>
  );
}

function OpenBox({ gameId, tag, paused }: { gameId: string; tag?: string; paused: boolean }) {
  const g = gameById(gameId);
  return (
    <span className="rm-box" style={vars({ "--rm-accent": g.palette.accent, "--rm-ground": g.palette.ground })}>
      <span className="rm-box__lid">
        <TvArt gameId={gameId} />
      </span>
      <span className="rm-box__tray">
        {tag && <span className="rm-box__tag">{tag}</span>}
      </span>
      {paused && (
        <span className="rm-box__ribbon" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24">
            <rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
            <rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
          </svg>
        </span>
      )}
    </span>
  );
}

/** CSS custom properties as a style object (React's CSSProperties has no index signature). */
function vars(v: Record<string, string>): CSSProperties {
  const out: CSSProperties = {};
  return Object.assign(out, v);
}

// ---- the couch: who's here tonight ----

function Couch({ seats, stagger }: { seats: CouchSeat[]; stagger: boolean }) {
  const n = seats.length;
  const gap = n > 3 ? 180 : 210;
  return (
    <div className="rm-couch">
      <svg className="rm-couch__art" width="900" height="290" viewBox="0 0 900 290" aria-hidden>
        <g filter="url(#rm-cut)">
          <rect x="40" y="0" width="820" height="180" rx="44" fill="#7d3f58" />
          <rect x="0" y="80" width="96" height="180" rx="38" fill="#6c3249" />
          <rect x="804" y="80" width="96" height="180" rx="38" fill="#6c3249" />
          <rect x="70" y="150" width="760" height="80" rx="24" fill="#95506d" />
          <rect x="30" y="212" width="840" height="64" rx="18" fill="#5a2a40" />
        </g>
        <path d="M313 20 V150 M587 20 V150" stroke="#5a2a40" strokeWidth="4" strokeOpacity="0.5" />
      </svg>
      {seats.map((x, i) => {
        const left = 450 + (i - (n - 1) / 2) * gap;
        const delay = stagger ? `${250 + i * 380}ms` : "0ms";
        return (
          <span key={x.person.id} className={`rm-seat is-${x.badge}`} style={{ left, animationDelay: delay }}>
            <Sticker person={x.person} size={176} dim={x.badge === "asleep"} />
            <b>{x.person.name}</b>
            <SeatBadge badge={x.badge} delay={stagger ? `${600 + i * 380}ms` : "0ms"} />
          </span>
        );
      })}
    </div>
  );
}

function SeatBadge({ badge, delay }: { badge: CouchSeat["badge"]; delay: string }) {
  if (badge === "none") return null;
  const icon = badge === "check" || badge === "ipad-paired" ? <Check size={30} /> : badge === "asleep" ? <Moon size={28} /> : <TabletIcon size={30} />;
  return (
    <i className="rm-seat__badge" style={{ animationDelay: delay }}>
      {badge === "ipad-paired" && (
        <span className="rm-seat__pad">
          <TabletIcon size={28} />
        </span>
      )}
      {icon}
    </i>
  );
}

// ---- a fine paper grain over everything ----

function Grain() {
  return (
    <svg className="rm-grain" width="1920" height="1080" aria-hidden>
      <filter id="rm-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.85  0 0 0 0.09 0" />
      </filter>
      <rect width="1920" height="1080" filter="url(#rm-noise)" />
    </svg>
  );
}
