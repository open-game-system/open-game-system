// Read-only views over the fake world that every surface shares. No game id is special-cased:
// seats come from each manifest's roles and tonight's people.
import { COUCH, GAMES, HOME, gameById, type GameManifest, type Instance, type OwnedDevice, type Person } from "../../world";

export const THIS_PHONE = "dev-dad-phone";
/** Tonight's couch: everyone's home; Mom is on the couch but sits this one out. */
export const PLAYERS = ["dad", "juneau", "ava"] as const;

export const people = HOME.people;
export const personOf = (id: string): Person => {
  const p = people.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
};
export const deviceOf = (personId: string): OwnedDevice | undefined =>
  HOME.devices.find((d) => d.personId === personId);
export const livingRoomTv = (): OwnedDevice => {
  const tv = HOME.devices.find((d) => d.kind === "tv" && d.online);
  if (!tv) throw new Error("no TV");
  return tv;
};

export interface SeatTonight {
  person: Person;
  role: string;
}

/** Fill a game's roles from who is playing tonight: grown-up roles to the phone holder, kid
 *  roles to kids, the "little" role to the littlest (or a kid role when the game has none). */
export function seatsFor(game: GameManifest): SeatTonight[] {
  const grown = game.roles.find((r) => r.audience === "grownup");
  const kid = game.roles.find((r) => r.audience === "kid");
  const little = game.roles.find((r) => r.audience === "little") ?? kid;
  const out: SeatTonight[] = [];
  for (const id of PLAYERS) {
    const p = personOf(id);
    const role = p.band === "grownup" ? grown : p.band === "kid" ? kid : little;
    if (role) out.push({ person: p, role: role.label });
  }
  return out;
}

export const saveOf = (gameId: string): Instance | undefined => COUCH.find((i) => i.gameId === gameId);
export const couchGames = (): GameManifest[] => GAMES.filter((g) => g.shape === "couch");
export { gameById };

/** "Mission 6 · Navigator rank" → "Mission 6": the resume point in a few words. */
export const resumePoint = (gameId: string): string => {
  const inst = saveOf(gameId);
  return inst ? (inst.title.split(" · ")[0] ?? inst.title) : "A new game";
};
