// Tonight's couch session: who's here, which seat each person takes in any game (from the
// manifest's roles, never per game id), and the swap state machine.
import { useEffect } from "react";
import type { Store } from "../../harness/store";
import { COUCH, GAMES, HEARTHISLE, HOME, gameById, type GameManifest, type Instance, type Person, type Role } from "../../world";
import { afterMove, type S, type SwapPhase } from "./state";

/** Here tonight: Mom is out, so Jonathan, Juneau and Ava. */
export const TONIGHT = ["dad", "juneau", "ava"];
export const people = (): Person[] => HOME.people.filter((p) => TONIGHT.includes(p.id));
export const personOf = (id: string): Person => {
  const p = HOME.people.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
};

export interface SeatPick {
  person: Person;
  role: Role;
  /** Who sat here last time, if it was someone else (shown so a swap never surprises). */
  lastTime?: string;
}

/** Each person takes the role written for their age band; littles fall back to the kid role. */
export function seatsFor(g: GameManifest, inst?: Instance): SeatPick[] {
  const pick = (p: Person) => g.roles.find((r) => r.audience === p.band) ?? g.roles.find((r) => r.audience === "kid") ?? g.roles[0];
  return people().flatMap((p) => {
    const role = pick(p);
    if (!role) return [];
    const prev = inst?.seats.find((s) => s.label === role.label);
    const prevId = prev?.personIds[0];
    const lastTime = prevId && prevId !== p.id ? personOf(prevId).name : undefined;
    return [{ person: p, role, lastTime }];
  });
}

export const instanceOf = (gameId: string): Instance | undefined =>
  COUCH.find((i) => i.gameId === gameId) ?? (HEARTHISLE.gameId === gameId ? HEARTHISLE : undefined);

export const game = gameById;
export const allGames = (): GameManifest[] => GAMES;

/** How long each swap beat holds before the next (live mode only). */
const BEAT: Record<SwapPhase, number> = { none: 0, saving: 1500, cutover: 1700, following: 1700, done: 0 };
const NEXT: Record<SwapPhase, SwapPhase> = { none: "none", saving: "cutover", cutover: "following", following: "done", done: "done" };

export function startSwap(s: S, to: string): S {
  return { ...s, phone: "game", target: to, swap: "saving", tvHeld: false, undo: false };
}

function advance(s: S): S {
  const next = NEXT[s.swap];
  if (next !== "done") return { ...s, swap: next };
  const to = s.target ?? s.current;
  // Undo is offered once, after a forward swap; using it doesn't offer an undo of the undo.
  return { ...s, swap: "done", previous: s.current, current: to, target: undefined, undo: !s.undone };
}

export function undoSwap(s: S): S {
  if (!s.previous) return s;
  return { ...startSwap(s, s.previous), undone: true };
}

/** Drives the swap beats forward in live mode. Mounted once (by the phone). */
export function useSwapDriver(store: Store<S>, swap: SwapPhase, shot: boolean) {
  useEffect(() => {
    if (shot || swap === "none" || swap === "done") return;
    const t = setTimeout(() => store.update(advance), BEAT[swap]);
    return () => clearTimeout(t);
  }, [store, swap, shot]);
}

export const playMove = (s: S): S => {
  const id = s.duel.openId;
  if (!id) return s;
  return { ...s, duel: { ...s.duel, played: true, games: afterMove(s.duel.games, id) } };
};
