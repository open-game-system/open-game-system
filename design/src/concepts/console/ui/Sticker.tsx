// The identity system: every person is the painted paper character they picked (a sticker with a
// white die-cut edge, like the kids' iPads), and every household is a little cluster of its
// people's stickers (a crest). Homes are told apart by who is in them, never by hue alone.
import type { Household, Person } from "../../../world";

/** A small, stable tilt per person, so a row of stickers looks stuck on by hand. */
export function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 11) - 5;
}

export function Sticker({ person, size = 40, dim = false, tilt = true, className = "" }: { person: Person; size?: number; dim?: boolean; tilt?: boolean; className?: string }) {
  return (
    <span
      className={`ogs-sticker ${dim ? "is-dim" : ""} ${className}`}
      style={{ width: size, height: size, transform: tilt ? `rotate(${tiltOf(person.id)}deg)` : undefined }}
      data-person={person.id}
    >
      <img src={person.sticker} alt="" draggable={false} />
    </span>
  );
}

/** Where each sticker sits in a crest (fractions of the crest box): one, two or three people. */
const SPOTS: Record<number, [number, number, number][]> = {
  1: [[0.5, 0.5, 1]],
  2: [
    [0.36, 0.56, 0.78],
    [0.68, 0.42, 0.66],
  ],
  3: [
    [0.34, 0.58, 0.7],
    [0.7, 0.38, 0.58],
    [0.72, 0.78, 0.46],
  ],
};

/** A household's crest: its people's stickers in a little cluster (up to three; grown-ups first). */
export function Crest({ household, size = 48, dim = false, className = "" }: { household: Household; size?: number; dim?: boolean; className?: string }) {
  const people = [...household.people].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  const spots = SPOTS[people.length] ?? SPOTS[1] ?? [];
  return (
    <span className={`ogs-crest ${dim ? "is-dim" : ""} ${className}`} style={{ width: size, height: size }} aria-hidden>
      {people.map((p, i) => {
        const spot = spots[i];
        if (!spot) return null;
        const [x, y, k] = spot;
        const s = size * k;
        return (
          <span key={p.id} className="ogs-crest__spot" style={{ left: x * size - s / 2, top: y * size - s / 2, zIndex: 3 - i }}>
            <Sticker person={p} size={s} />
          </span>
        );
      })}
    </span>
  );
}

const rank = (p: Person): number => (p.band === "grownup" ? 0 : p.band === "kid" ? 1 : 2);

/** A row of people's stickers, overlapping a little (who's here, who sits where). */
export function StickerRow({ people, size = 28, dimmed = [] }: { people: Person[]; size?: number; dimmed?: string[] }) {
  return (
    <span className="ogs-stickers" aria-hidden>
      {people.map((p) => (
        <Sticker key={p.id} person={p} size={size} dim={dimmed.includes(p.id)} />
      ))}
    </span>
  );
}
