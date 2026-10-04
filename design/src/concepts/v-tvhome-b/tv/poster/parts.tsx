// "Poster wall": the TV between games is a cinema lobby. One full-bleed poster for the game in
// focus (its real art, HUD-safe via the manifest's `art.safe`), the resume point as its tagline,
// the family's stickers as the "starring" credit; the other games hang as small one-sheets along
// the bottom like a lobby wall. The console's dotted follow path becomes the marquee's bulbs.
import type { CSSProperties, ReactNode } from "react";
import { gameById, type Person } from "../../../../world";
import { DuelArt } from "../../ui/GameArt";
import { Sticker } from "../../ui/Sticker";
import { resumePoint } from "../../state";
import { couchStatus } from "../../status";
import { frameFor } from "../frame";

/** Display size for a title so the longest names still sit on one line of the poster. */
export const titleSize = (name: string, max: number, width: number): number => Math.min(max, Math.round(width / (name.length * 0.5)));

/** A game's art cropped portrait (a one-sheet), zoomed by its HUD-safe crop so no HUD shows. */
export function OneSheet({ gameId, title = true, className = "", style }: { gameId: string; title?: boolean; className?: string; style?: CSSProperties }) {
  const f = frameFor(gameId);
  const g = gameById(gameId);
  return (
    <span className={`pw-sheet ${className}`} style={style}>
      {f ? (
        <img src={f.src} alt="" style={{ objectPosition: `${f.ox}% ${f.oy}%`, transform: `scale(${f.scale})`, transformOrigin: `${f.ox}% ${f.oy}%` }} />
      ) : (
        <DuelArt />
      )}
      {title && <b className="pw-sheet__title">{g.name}</b>}
    </span>
  );
}

/** A row of marquee bulbs: the console's dotted path, lit. */
export function Bulbs({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`pw-bulbs ${className}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i % 6) * 120}ms` }} />
      ))}
    </span>
  );
}

/** The poster's top line: a lit marquee label on the left, the time on the right. */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <header className="pw-top">
      <span className="pw-marquee">
        <Bulbs n={4} />
        <span>{children}</span>
      </span>
      <span className="pw-clock">
        <b>7:10</b>
        <span>Fri 3 Oct</span>
      </span>
    </header>
  );
}

/** The billing block: STARRING and each person as their sticker over a name in caps. */
export function Billing({ people, size = 84, label = "Starring", children }: { people: Person[]; size?: number; label?: string; children?: (p: Person) => ReactNode }) {
  return (
    <div className="pw-billing">
      <span className="pw-billing__label">{label}</span>
      <ul>
        {people.map((p, i) => (
          <li key={p.id} style={{ animationDelay: `${300 + i * 110}ms` }}>
            <span className="pw-billing__sticker">
              <Sticker person={p} size={size} />
              {children?.(p)}
            </span>
            <span className="pw-billing__name">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface WallItem {
  gameId: string;
  /** The placard under the poster: the resume point, or a showtime. */
  line: string;
  lit?: boolean;
}

/** The lobby wall: small one-sheets in a row, each with a placard; the one in focus is lit. */
export function LobbyWall({ items, className = "" }: { items: WallItem[]; className?: string }) {
  return (
    <ul className={`pw-wall ${className}`} aria-label="Also showing">
      {items.map((it, i) => (
        <li key={it.gameId} className={it.lit ? "is-lit" : ""} style={{ animationDelay: `${200 + i * 70}ms` }}>
          <span className="pw-wall__case">
            <OneSheet gameId={it.gameId} />
          </span>
          <span className="pw-wall__line">{it.line}</span>
        </li>
      ))}
    </ul>
  );
}

/** The short placard under a couch game's one-sheet: where it picks up, "New tonight" or "Any time". */
export function placardFor(gameId: string, onTv: string | null, savedTonight: Record<string, string>): string {
  const st = couchStatus(gameId, onTv, savedTonight);
  return st.kind === "paused" ? resumePoint(gameId) : st.kind === "new" ? "New tonight" : "Any time";
}
