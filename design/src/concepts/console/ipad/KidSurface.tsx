// A paired kid iPad. It has no menus and no way out: it shows whatever tonight's game gives this
// child, and follows the TV by itself. Every screen here is wordless.
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { HOME, gameById, person } from "../../../world";
import { GameKidView } from "../games/registry";
import { seatPlan, type S } from "../state";
import { KidAsleep } from "./KidAsleep";
import { KidFollow } from "./KidFollow";
import { KidIdle } from "./KidIdle";

export function KidSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  const who = person(s.ipad);
  const device = HOME.devices.find((d) => d.personId === who.id && d.kind === "ipad");
  if (device && s.asleep.includes(device.id)) return <KidAsleep who={who} battery={device.battery ?? 0} />;
  if (s.switching) return <KidFollow key={`${s.switching.from}-${s.switching.to}`} sw={s.switching} who={who} />;
  if (s.onTv) {
    const seat = seatPlan(gameById(s.onTv)).find((x) => x.person.id === who.id);
    if (seat) {
      return (
        <div className={`kid-game ${s.lateJoin === device?.id ? "kid-game--late" : ""}`} key={s.onTv}>
          <GameKidView gameId={s.onTv} who={who} role={seat.role} />
        </div>
      );
    }
  }
  return <KidIdle who={who} />;
}
