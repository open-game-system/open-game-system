// Variant "Instant + receipt": on the phone the switch is a cut. The next game's art wipes across
// in a fraction of a second; the people pop in under it as their devices land. ~1 s, then the new
// controller, with the receipt chip on top (Strips.tsx). No seat list, no progress screen.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { pointIn, seatPlan, type S, type Switching as Sw } from "../state";
import { GameArt } from "../ui/GameArt";
import { Check, Moon } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";

export function Switching({ s, sw, asleep }: { s: S; sw: Sw; asleep: string[]; store: Store<S> }) {
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  const seats = seatPlan(to);
  const cut = sw.phase !== "saving";
  return (
    <div className={`cx-cut cx-cut--${sw.phase}`}>
      <div className="cx-cut__from" aria-hidden>
        <GameArt gameId={from.id} alt />
      </div>
      <div className="cx-cut__to" aria-hidden>
        <GameArt gameId={to.id} alt />
      </div>
      <div className="cx-cut__body">
        <span className={`cx-cut__saved ${cut ? "is-saved" : ""}`}>
          <Check size={16} /> {from.name} saved · {pointIn(s, from.id)}
        </span>
        <h2 className="ogs-display">{to.name}</h2>
        <p>{pointIn(s, to.id)}</p>
        <ul className="cx-cut__who" aria-label="Who's in">
          {seats.map((x, i) => {
            const sleeping = !!x.device && asleep.includes(x.device.id);
            const inNow = sw.phase === "following" || (cut && x.device?.kind === "phone");
            return (
              <li key={x.person.id} className={sleeping ? "is-asleep" : inNow ? "is-in" : ""} style={{ animationDelay: `${i * 70}ms` }}>
                <Sticker person={x.person} size={52} dim={sleeping || !inNow} />
                {sleeping && (
                  <i>
                    <Moon size={14} />
                  </i>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
