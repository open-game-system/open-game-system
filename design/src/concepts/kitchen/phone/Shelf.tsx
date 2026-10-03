// The shelf: every game the household has, with where each one stands. Adding a game to the shelf
// is a manifest; the status line is whatever the game reports (or "New" for Tier 0).
import { GAMES, COUCH, HEARTHISLE } from "../../../world";
import { Section } from "../ui/Bits";

const statusOf = (gameId: string): string => {
  if (gameId === HEARTHISLE.gameId) return "Tonight at 8 · turn 14";
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return "Your turn in 2";
  return inst.status === "suspended" ? `${inst.title.split(" · ")[0] ?? ""} · paused` : inst.title.split(" · ")[0] ?? inst.title;
};

export function Shelf() {
  return (
    <Section title="The shelf" className="pl-shelf-section">
      <div className="pl-shelf">
        {GAMES.filter((g) => g.art.tv).map((g) => (
          <div key={g.id} className="pl-shelf-item">
            <img src={g.art.tv} alt="" />
            <b>{g.name}</b>
            <span>{statusOf(g.id)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
