// Before tonight starts the living room TV isn't ours: nothing from OGS is on it. The moment the phone
// says Play on TV, the console comes up as one calm moment (never a spinner on black): which room,
// which game, and who is joining, each person's sticker checking in as their device arrives.
import { gameById, type Person } from "../../../world";
import { hereTonight, type S } from "../state";
import { Sticker } from "../ui/Sticker";
import { Check } from "../ui/Icons";
import { PulseMark } from "./Motif";
import { TvArt } from "./TvArt";

export function TvOff() {
  return <div className="ct-off" aria-label="TV not cast" />;
}

/** Grown-ups' phones answer first, then the kids' iPads (the order devices really join in). */
const joinOrder = (p: Person): number => (p.band === "grownup" ? 0 : 1);

export function TvConnecting({ s }: { s: S }) {
  const game = s.onTv ? gameById(s.onTv) : null;
  const people = [...hereTonight(s)].sort((a, b) => joinOrder(a) - joinOrder(b));
  const names = people.map((p) => p.name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  return (
    <div className="ct-connecting">
      {game && (
        <div className="ct-connecting__bg" aria-hidden>
          <TvArt gameId={game.id} />
        </div>
      )}
      <div className="ct-connecting__shade" />
      <header className="ct-connecting__top">
        <PulseMark size={52} />
        <span>Living room</span>
      </header>
      <section className="ct-connecting__body">
        <h1 className="ct-connecting__line">{game ? `Starting ${game.name}` : "Connecting"}</h1>
        {who && <p className="ct-connecting__sub">{who} joining</p>}
        <ul className="ct-connecting__who">
          {people.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${120 + i * 90}ms` }}>
              <span className="ct-connecting__sticker" style={{ animationDelay: `${300 + i * 450}ms` }}>
                <Sticker person={p} size={128} />
                <i style={{ animationDelay: `${600 + i * 450}ms` }}>
                  <Check size={30} />
                </i>
              </span>
              <b>{p.name}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
