// A group thread of three homes. A seat is a household; each home sees only its own hands,
// and other homes never see our kids.
import { HEARTHISLE, gameById, HOUSEHOLDS } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, type S } from "../state";
import { NavBar, StatusBar } from "../ui/Chrome";
import { Quilt } from "../ui/Patch";
import { IconLock, IconTv } from "../ui/Icons";
import { SEAT_PATCHES } from "./PeopleHome";

export function GameNight({ store }: { store: Store<S> }) {
  const g = gameById("hearthisle");
  return (
    <div className="pf-phone">
      <StatusBar />
      <NavBar onBack={() => store.update(go({ kind: "people", filter: "all" }))} avatar={<Quilt people={SEAT_PATCHES} size={40} />} title="Friday game night" sub="Hearthisle · 3 homes" />
      <div className="pf-scroll">
        <div className="pf-gn-hero">
          <img src={g.art.tv} alt="" />
          <div className="pf-gn-cap">
            <p className="pf-gcard-name" style={{ color: "#f7f2e9" }}>Turn 14 · paused last Friday</p>
            <h3>Resumes tonight at 8:00</h3>
          </div>
        </div>
        <ul className="pf-gn-seats">
          {HEARTHISLE.seats.map((seat) => {
            const hh = HOUSEHOLDS.find((h) => h.id === seat.householdId);
            const ours = seat.householdId === "hh-mumm";
            const shown = ours ? "Jonathan + Juneau" : hh ? `${hh.city}${hh.devices.some((d) => d.kind === "tv") ? " · on their TV" : " · on their phones"}` : "";
            return (
              <li key={seat.householdId}>
                <Quilt people={[{ id: seat.householdId, color: seat.color }]} size={44} />
                <span className="pf-follow-main">
                  <b>{ours ? "Us" : hh?.name}</b>
                  <span>{shown}</span>
                </span>
                <span className="pf-gn-score">{seat.score}</span>
              </li>
            );
          })}
        </ul>
        <p className="pf-gn-trust">
          <IconLock /> The Okafors and Nana &amp; Pop see our seat as "The Mumms". They never see Juneau's name or picture, and each home sees only its own hand.
        </p>
        <div style={{ padding: "8px 20px 24px" }}>
          <button className="pf-primary" data-bot="cast-game-night">
            <IconTv size={20} /> <span>Cast to the living room at 8</span>
          </button>
        </div>
      </div>
    </div>
  );
}
