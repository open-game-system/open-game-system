// Between the cut-over and the first move: the new game's world, and everyone arriving in their seat.
// The band sits along the bottom edge only; the game is about to take the whole screen.
import { HOME, type GameManifest } from "../../../world";
import { Patch } from "../ui/Patch";
import { IconBattery, IconCheck } from "../ui/Icons";
import { pickUp, seatFor } from "../ui/seats";

const ON_COUCH = ["dad", "juneau", "ava"];

export function TvArrivals({ game, arrived, avaAsleep }: { game: GameManifest; arrived: string[]; avaAsleep: boolean }) {
  const people = HOME.people.filter((p) => ON_COUCH.includes(p.id));
  return (
    <>
      <img className="pf-tv-art" src={game.art.tv} alt="" />
      <div className="pf-tv-band">
        <div className="pf-tv-band-title">
          <p className="pf-tv-kicker">{game.name}</p>
          <h2>{pickUp(game.id)}</h2>
        </div>
        <div className="pf-tv-band-seats">
          {people.map((p) => {
            const here = p.band === "grownup" || arrived.includes(p.id);
            const asleep = p.id === "ava" && avaAsleep;
            return (
              <div key={p.id} className={`pf-tv-seat${here ? " here" : ""}`}>
                <span className="pf-tv-seat-patch">
                  <Patch person={p} size={84} dim={!here} />
                  <span className="pf-tv-seat-mark">{asleep ? <IconBattery level={0.09} size={26} /> : here ? <IconCheck size={26} /> : null}</span>
                </span>
                <span>
                  <b>{p.name}</b>
                  <em>{asleep ? "iPad asleep" : seatFor(game.id, p)}</em>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
