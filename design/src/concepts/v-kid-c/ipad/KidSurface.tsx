// A paired kid iPad. It has no menus and no way out: it shows whatever tonight's game gives this
// child, and follows the TV by itself. Every screen OGS owns here is the child's buddy (Buddy.tsx),
// huge and close up; the game's own screens keep the little name tag.
import { useRef } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { HOME, gameById, person, type Person } from "../../../world";
import { GameKidView } from "../games/registry";
import { seatPlan, type S } from "../state";
import { KidArrive } from "./KidArrive";
import { KidAsleep } from "./KidAsleep";
import { Buddy } from "./Buddy";
import { KidTag } from "./KidTag";
import { mashing } from "./mash";
import { isUnpaired, KidUnpaired } from "./KidUnpaired";

/** `seat` is whose iPad this is (from the harness stage); scenarios without one use `s.ipad`. */
export function KidSurface({ store, seat }: { store: Store<S>; seat?: string }) {
  const s = useStore(store);
  const who = person(seat ?? s.ipad);
  // First run: until a grown-up pairs it, this iPad is nobody's yet (no character, no tag). The
  // moment it pairs, the child's character arrives with a party (only on that change, never on load).
  const pairing = s.firstRun ? s.setup.ipads[who.id] : undefined;
  const was = useRef(pairing);
  const paired = useRef(0);
  if (was.current !== pairing) {
    if (pairing === "paired" && isUnpaired(was.current)) paired.current += 1;
    was.current = pairing;
  }
  if (pairing && isUnpaired(pairing)) return <KidUnpaired pairing={pairing} />;
  return (
    <>
      <div className={paired.current > 0 ? "kd-paired" : "kd-screen"} key={paired.current}>
        <KidScreen s={s} who={who} />
      </div>
      {paired.current > 0 && <KidArrive key={paired.current} who={who} />}
      {inGame(s, who) && <KidTag who={who} />}
    </>
  );
}

function KidScreen({ s, who }: { s: S; who: Person }) {
  const device = HOME.devices.find((d) => d.personId === who.id && d.kind === "ipad");
  if (device && s.asleep.includes(device.id)) return <KidAsleep who={who} battery={device.battery ?? 0} />;
  // Menu (TV paused) and the switch are one continuous journey: same component, keyed by the game
  // being left, so the character keeps walking from "paused" through "following" without a cut.
  // The menu (TV paused) and the switch are one continuous buddy: same component, keyed by the
  // game being left, so it turns, waves and catches without a cut.
  if (s.switching) return <Buddy key={s.switching.from} who={who} mood={s.switching.phase} from={s.switching.from} to={s.switching.to} mashDemo={mashing.has(s)} />;
  if (s.menu && s.onTv) return <Buddy key={s.onTv} who={who} mood="paused" from={s.onTv} />;
  if (s.onTv) {
    const place = seatOf(s.onTv, who);
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
  return <Buddy who={who} mood="idle" />;
}

const seatOf = (gameId: string, who: Person) => seatPlan(gameById(gameId)).find((x) => x.person.id === who.id);

/** The game's own screen is up (not a buddy screen): only then does the little name tag hang. */
function inGame(s: S, who: Person): boolean {
  const device = HOME.devices.find((d) => d.personId === who.id && d.kind === "ipad");
  if (device && s.asleep.includes(device.id)) return false;
  if (s.switching || (s.menu && s.onTv)) return false;
  return !!s.onTv && !!seatOf(s.onTv, who);
}
