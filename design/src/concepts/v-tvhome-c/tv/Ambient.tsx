// Quiet ambient: between games the TV is a calm presence, not a menu. A slow, nearly still night
// drawn from the focused game's own art (softened, dimmed, drifting), a large clock, exactly one
// line, and the family's stickers small and low. All choosing happens on the phone; the TV answers.
import type { Person } from "../../../world";
import { Sticker } from "../ui/Sticker";
import { frameFor } from "./frame";

export interface AmbientSeat {
  person: Person;
  /** Lit = here / joined / paired. Unlit stickers wait, faded. */
  lit: boolean;
  /** Joins one after another (casting): the sticker lights up on a delay. */
  joinAt?: number;
}

export interface AmbientProps {
  /** Whose art the night is made from; null = the plain living-room night (first run). */
  gameId: string | null;
  /** The one line: what (bright) — where to choose (soft). */
  what: string;
  where: string;
  seats: AmbientSeat[];
  /** Scenes enter differently: a crossfade between focuses, a game settling back into the night. */
  enter?: "fade" | "settle";
}

export function Ambient({ gameId, what, where, seats, enter = "fade" }: AmbientProps) {
  const f = gameId ? frameFor(gameId) : null;
  return (
    <div className={`qa qa--${enter}`}>
      <div className="qa__night" key={gameId ?? "room"} aria-hidden>
        {f ? <img src={f.src} alt="" style={{ transform: `scale(${f.scale})`, transformOrigin: `${f.ox}% ${f.oy}%` }} /> : <span className="qa__room" />}
      </div>
      <div className="qa__veil" aria-hidden />
      <section className="qa__low">
        <time className="qa__clock">7:10</time>
        <p className="qa__line" key={`${what}|${where}`}>
          <b>{what}</b>
          <span> — {where}</span>
        </p>
      </section>
      {seats.length > 0 && (
        <ul className="qa__seats" aria-label="Here tonight">
          {seats.map((x) => (
            <li key={x.person.id} className={x.lit ? "is-lit" : x.joinAt !== undefined ? "is-joining" : "is-waiting"} style={x.joinAt !== undefined ? { animationDelay: `${x.joinAt}ms` } : undefined}>
              <Sticker person={x.person} size={84} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Day 4" → "day 4", to sit mid-line after the game's name. */
export const lowerFirst = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);
