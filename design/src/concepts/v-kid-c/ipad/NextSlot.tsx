// The "next" window while a grown-up is choosing (console menu open, TV paused). Never an empty
// slab: the window breathes, and the games on the TV's Up next shelf drift through it one after
// another, soft and dreamy, like a toy deciding. A ring of sparkles circles it. No words.
import { GAMES } from "../../../world";
import { GameArt } from "../ui/GameArt";

const CYCLE = 1.6;

export function NextSlot({ from }: { from: string }) {
  const next = GAMES.filter((g) => g.shape === "couch" && g.id !== from);
  const total = next.length * CYCLE;
  return (
    <>
      <span className="kd-next__deck" style={{ animationDuration: `${total}s` }}>
        {next.map((g, i) => (
          <span
            key={g.id}
            className="kd-next__card"
            style={{ animationDuration: `${total}s`, animationDelay: `${i * CYCLE - total}s` }}
          >
            <GameArt gameId={g.id} />
          </span>
        ))}
      </span>
      <span className="kd-next__orbit" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ animationDelay: `${-i * 0.5}s` }} />
        ))}
      </span>
    </>
  );
}
