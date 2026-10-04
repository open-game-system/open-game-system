// The session's clock: the simulated world the prototype plays (switch phases, other homes' rolls,
// the cast coming up). One clock for every device, run from the phone surface, frozen in shots.
// Owned by the TV owner (the TV is the timeline the other devices mirror).
import { useEffect } from "react";
import type { Store } from "../../harness/store";
import { answerInvites, passTurn, US } from "./nights";
import { advance, type S, type SwitchPhase } from "./state";

/**
 * How long each phase of a switch holds, in ms. One ordering on every device, cause before effect:
 *   saving    — phone spins "Saving"; the TV folds the game into a card and fills its save ring.
 *   cutover   — phone shows ✓; a beat later the same ✓ stamps onto the TV's saved card; the kids'
 *               characters walk the dotted path on their iPads (TV: their seats are on the way).
 *   following — the iPads arrive (TV seats check in), then the new game opens from its own tile on the
 *               TV and on the iPads; the "now playing" strip rises along the TV's bottom edge.
 * After `following` the strip collapses into the corner chip (TvPlaying, ~1.5 s of CSS), so the whole
 * switch is ~5.3 s of continuous motion: no frozen tail.
 */
export const SWITCH_MS: Record<SwitchPhase, number> = { saving: 1000, cutover: 1300, following: 1500 };

/** The phone drives the switch's timeline (one clock for the whole session; frozen in shots). */
export function useSwitchClock(s: S, store: Store<S>, shot: boolean) {
  const phase = s.switching?.phase;
  useEffect(() => {
    if (shot || !phase) return;
    const t = setTimeout(() => store.update(advance), SWITCH_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, shot, store]);
}

/**
 * The night is waiting on a home that dropped: the host hasn't decided yet ("now"), or chose to hold
 * the board ("recovering"). Every device shows the board waiting, so no roll may pass behind it.
 */
export const waitingOnHome = (s: S): boolean => s.fault?.kind === "home-drops" && (s.fault.phase === "now" || s.fault.phase === "recovering");

/**
 * The other homes' side of a game night, played by the prototype: invited homes answer a beat after
 * the invite goes out, and while a night is live the other homes take their rolls until it's ours.
 * Their rolls don't depend on which screen this phone shows. No roll passes while the night is paused (for the night, or the console menu has the TV paused) or
 * while it waits on a home that dropped; a home that's away by the host's choice is skipped.
 */
export function useNightClock(s: S, store: Store<S>, shot: boolean) {
  const n = s.nights.list.find((x) => x.id === s.nights.open);
  const answering = !!n && n.status === "setup" && n.homes.some((h) => h.reply === "invited");
  const live = !!n && n.status === "live" && !s.menu && !waitingOnHome(s);
  // The other homes roll whatever Dad's phone is showing (Home, a duel): the TV and the lane follow.
  const rolling = live && !!n && n.turnOf !== US ? `${n.id}:${n.turn}` : null;
  useEffect(() => {
    if (shot || !answering) return;
    const t = setTimeout(() => store.update((x) => ({ ...x, nights: answerInvites(x.nights) })), 2600);
    return () => clearTimeout(t);
  }, [answering, shot, store]);
  useEffect(() => {
    if (shot || !rolling) return;
    const id = rolling.split(":")[0] ?? "";
    const t = setTimeout(() => store.update((x) => ({ ...x, nights: passTurn(x.nights, id) })), 2200);
    return () => clearTimeout(t);
  }, [rolling, shot, store]);
}

/** Play on TV → the stream is up. The TV's casting moment checks each sticker in by ~1.5 s (CSS), so
 * the game arrives right after the last person does. */
export const CAST_MS = 2200;

/** The cast connects a beat after Play on TV (frozen in shots). */
export function useCastClock(s: S, store: Store<S>, shot: boolean) {
  const connecting = s.cast === "connecting";
  useEffect(() => {
    if (shot || !connecting) return;
    const t = setTimeout(() => store.update((x) => ({ ...x, cast: "on" })), CAST_MS);
    return () => clearTimeout(t);
  }, [connecting, shot, store]);
}

