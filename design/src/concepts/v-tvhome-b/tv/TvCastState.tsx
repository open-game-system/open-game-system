// Before tonight starts the living room TV isn't ours: nothing from OGS is on it. The moment the phone
// says Play on TV, the curtain goes up: the game's poster drops in and each person's sticker checks
// in on its starring credit as their device arrives (never a spinner on black).
import { gameById, type Person } from "../../../world";
import { hereTonight, resumePoint, type S } from "../state";
import { Check } from "../ui/Icons";
import { Billing, Marquee, titleSize } from "./poster/parts";
import { TvArt } from "./TvArt";

export function TvOff() {
  return <div className="ct-off" aria-label="TV not cast" />;
}

/** Grown-ups' phones answer first, then the kids' iPads (the order devices really join in). */
const joinOrder = (p: Person): number => (p.band === "grownup" ? 0 : 1);

export function TvConnecting({ s }: { s: S }) {
  const game = s.onTv ? gameById(s.onTv) : null;
  const people = [...hereTonight(s)].sort((a, b) => joinOrder(a) - joinOrder(b));
  const point = game ? resumePoint(game.id) : "";
  return (
    <div className="pw-home pw-curtain">
      {game && (
        <div className="pw-home__art is-in" aria-hidden>
          <TvArt gameId={game.id} />
        </div>
      )}
      <div className="pw-home__shade" />
      <Marquee>
        Curtain up <em>· living room</em>
      </Marquee>
      <section className="pw-poster pw-curtain__poster">
        <p className="pw-poster__tagline">{game ? `Tonight, picking up at ${point}` : "Tonight in the living room"}</p>
        <h1 className="pw-poster__title" style={{ fontSize: titleSize(game?.name ?? "Connecting", 196, 1240) }}>
          {game ? game.name : "Connecting"}
        </h1>
        <Billing people={people} size={96}>
          {(p) => (
            <i className="pw-billing__in" style={{ animationDelay: `${600 + people.indexOf(p) * 450}ms` }}>
              <Check size={30} />
            </i>
          )}
        </Billing>
        <p className="pw-curtain__line">Everyone's device is taking its seat by name</p>
      </section>
    </div>
  );
}
