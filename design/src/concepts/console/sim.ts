// The session's clock: the simulated world the prototype plays (switch phases, other homes' rolls,
// the cast coming up). One clock for every device, run from the phone surface, frozen in shots.
// Owned by the TV owner (the TV is the timeline the other devices mirror).
import { useEffect } from "react";
import type { Store } from "../../harness/store";
import { answerInvites, passTurn, US } from "./nights";
import { advance, type S } from "./state";

/** The phone drives the switch's timeline (one clock for the whole session; frozen in shots). */
export function useSwitchClock(s: S, store: Store<S>, shot: boolean) {
  const phase = s.switching?.phase;
  useEffect(() => {
    if (shot || !phase) return;
    const t = setTimeout(() => store.update(advance), phase === "saving" ? 1300 : 1500);
    return () => clearTimeout(t);
  }, [phase, shot, store]);
}

/**
 * The other homes' side of a game night, played by the prototype: invited homes answer a beat after
 * the invite goes out, and while a night is live the other homes take their rolls until it's ours.
 */
export function useNightClock(s: S, store: Store<S>, shot: boolean) {
  const n = s.nights.list.find((x) => x.id === s.nights.open);
  const answering = !!n && n.status === "setup" && n.homes.some((h) => h.reply === "invited");
  const rolling = s.phone === "night" && !!n && n.status === "live" && n.turnOf !== US ? `${n.id}:${n.turn}` : null;
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

/** The cast connects a beat after Play on TV (frozen in shots). */
export function useCastClock(s: S, store: Store<S>, shot: boolean) {
  const connecting = s.cast === "connecting";
  useEffect(() => {
    if (shot || !connecting) return;
    const t = setTimeout(() => store.update((x) => ({ ...x, cast: "on" })), 2600);
    return () => clearTimeout(t);
  }, [connecting, shot, store]);
}

