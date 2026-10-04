// A paired kid iPad. It has no menus and no way out: it shows whatever tonight's game gives this
// child, and follows the TV by itself. Every screen here is wordless and landscape (two hands,
// thumbs at the bottom edge); the child's own character always stands at the bottom centre.
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { HOME, gameById, person, type Person } from "../../../world";
import { GameKidView } from "../games/registry";
import { seatPlan, type S } from "../state";
import { KidArrive } from "./KidArrive";
import { KidAsleep } from "./KidAsleep";
import { KidIdle } from "./KidIdle";
import { KidTag } from "./KidTag";
import { mashing } from "./mash";
import { KidTravel } from "./KidTravel";

/** `seat` is whose iPad this is (from the harness stage); scenarios without one use `s.ipad`. */
export function KidSurface({ store, seat }: { store: Store<S>; seat?: string }) {
  const s = useStore(store);
  const who = person(seat ?? s.ipad);
  return (
    <>
      <KidScreen s={s} who={who} />
      <KidTag who={who} />
    </>
  );
}

function KidScreen({ s, who }: { s: S; who: Person }) {
  const device = HOME.devices.find((d) => d.personId === who.id && d.kind === "ipad");
  if (device && s.asleep.includes(device.id)) return <KidAsleep who={who} battery={device.battery ?? 0} />;
  // Menu (TV paused) and the switch are one continuous journey: same component, keyed by the game
  // being left, so the character keeps walking from "paused" through "following" without a cut.
  if (s.switching) return <KidTravel key={s.switching.from} from={s.switching.from} to={s.switching.to} phase={s.switching.phase} who={who} mashDemo={mashing.has(s)} />;
  if (s.menu && s.onTv) return <KidTravel key={s.onTv} from={s.onTv} to={null} phase="paused" who={who} />;
  if (s.onTv) {
    const place = seatPlan(gameById(s.onTv)).find((x) => x.person.id === who.id);
    if (place) {
      const late = !!device && s.lateJoin === device.id;
      return (
        <div className={`kd-game ${late ? "kd-game--late" : ""}`} key={s.onTv}>
          <GameKidView gameId={s.onTv} who={who} role={place.role} />
          {late && <KidArrive who={who} />}
        </div>
      );
    }
  }
  return <KidIdle who={who} />;
}
