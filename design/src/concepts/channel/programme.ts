// Tonight's programme: the running order, who's on the couch, and who sits where in each segment.
// Everything comes from the world (manifests, instances, household); nothing is special-cased per game.
import { COUCH, HEARTHISLE, HOME, gameById, person, type GameManifest, type Instance, type Person } from "../../world";

/** Who's on the couch tonight (Mom is out at book club; her phone isn't in the session). */
export const TONIGHT: Person[] = HOME.people.filter((p) => p.id !== "mom");
export const DIRECTOR: Person = person("dad");

export const CHANNEL = { name: "Channel Mumm", tv: "Living room TV" };

export interface Segment {
  game: GameManifest;
  instance: Instance;
  /** Where the segment sits on tonight's clock. */
  slot: string;
}

const inst = (gameId: string): Instance => {
  const i = COUCH.find((x) => x.gameId === gameId);
  if (!i) throw new Error(`no instance for ${gameId}`);
  return i;
};

export const segment = (gameId: string): Segment => ({ game: gameById(gameId), instance: inst(gameId), slot: SLOTS[gameId] ?? "" });

const SLOTS: Record<string, string> = {
  "rocket-crew": "7:02",
  "bake-shop": "7:25",
  "story-nook": "7:45",
  "peekaboo-garden": "",
  "night-flight": "",
};

/** The running order the director keeps: on now, then up next (in order). */
export const RUNNING_ORDER = ["rocket-crew", "bake-shop", "story-nook"];
/** Other couch games the director can cut to (from the library). */
export const ALSO = ["peekaboo-garden", "night-flight"];

export const upNext = (onAir: string): string[] => RUNNING_ORDER.filter((g) => g !== onAir && g !== "story-nook").concat("story-nook").filter((g) => g !== onAir);

export interface Seat {
  person: Person;
  role: string;
  device: string;
}

/** Seats come from the manifest's roles and the household's paired devices: never asked again. */
export function seatsFor(game: GameManifest): Seat[] {
  const role = (aud: "grownup" | "kid" | "little") => game.roles.find((r) => r.audience === aud) ?? game.roles.find((r) => r.audience === "kid");
  return TONIGHT.flatMap((p) => {
    const r = role(p.band);
    if (!r) return [];
    const dev = HOME.devices.find((d) => d.personId === p.id);
    const device = p.id === DIRECTOR.id ? "this phone" : dev?.kind === "ipad" ? (p.id === "juneau" ? "his iPad" : "her iPad") : "phone";
    return [{ person: p, role: r.label, device }];
  });
}

export const hearthisle = HEARTHISLE;
export const personById = (id: string): Person | undefined => HOME.people.find((p) => p.id === id);

/** "Mission 6", "Day 4": where a segment stands. */
export const point = (seg: Segment): string => seg.instance.title.split(" · ")[0] ?? seg.instance.title;
/** The game's own words for where it picks up ("Mrs. Bear is waiting for a strawberry cupcake"). */
export const pickup = (seg: Segment): string => seg.instance.detail.replace(/^Paused [^·]+· /, "");
