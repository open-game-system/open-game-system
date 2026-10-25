import type { Seat, ServerState } from "../room.types";
import { MAX_PLAYERS } from "../room.schemas";
import { type Color, ROUNDS, TIMING, makeRound, scorePick } from "./rules";

/**
 * The room as pure functions of its state: join, start, pick, advance. The machine (room.machine.ts)
 * calls these and re-derives every screen's view (views.ts) after each one. A no-op returns the
 * same object, so tests can check "nothing changed" with toBe.
 */
export function newRoom(init: { roomCode: string; tvId: string; seed: number }): ServerState {
  return { ...init, phase: "lobby", round: 0, endsAt: null, seats: [], current: null };
}

const NAME_MAX = 16;
function tidyName(raw: string | undefined, fallback: string): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX).trim();
  return name.length > 0 ? name : fallback;
}

export function join(
  s: ServerState,
  who: { callerId: string; name: string | undefined; ogsId: string | null },
): ServerState {
  if (who.callerId === s.tvId) return s;
  if (s.seats.some((x) => x.callerId === who.callerId)) return s;
  if (s.seats.length >= MAX_PLAYERS) return s;
  const n = s.seats.length + 1;
  const seat: Seat = {
    callerId: who.callerId,
    seat: `p${n}`,
    name: tidyName(who.name, `Player ${n}`),
    ogsId: who.ogsId,
    score: 0,
    pick: null,
    correct: null,
  };
  return { ...s, seats: [...s.seats, seat] };
}

export const isHost = (s: ServerState, callerId: string) => s.seats[0]?.callerId === callerId;

function beginRound(s: ServerState, round: number, now: number): ServerState {
  return {
    ...s,
    phase: "show",
    round,
    endsAt: now + TIMING.showMs,
    current: makeRound(s.seed, round),
    seats: s.seats.map((x) => ({ ...x, pick: null, correct: null })),
  };
}

export function start(s: ServerState, callerId: string, now: number): ServerState {
  if (!isHost(s, callerId)) return s;
  if (s.phase === "lobby") return beginRound(s, 0, now);
  if (s.phase !== "over") return s;
  const fresh = { ...s, seed: (s.seed * 48271 + 1) % 2147483647, seats: s.seats.map((x) => ({ ...x, score: 0 })) };
  return beginRound(fresh, 0, now);
}

function reveal(s: ServerState, now: number): ServerState {
  const round = s.current;
  if (!round) return s;
  return {
    ...s,
    phase: "reveal",
    endsAt: now + TIMING.revealMs,
    seats: s.seats.map((x) => {
      const points = scorePick(round, x.pick);
      return { ...x, score: x.score + points, correct: points > 0 };
    }),
  };
}

export function pick(s: ServerState, callerId: string, color: Color, now: number): ServerState {
  if (s.phase !== "answer") return s;
  const seat = s.seats.find((x) => x.callerId === callerId);
  if (!seat || seat.pick !== null) return s;
  const next = { ...s, seats: s.seats.map((x) => (x === seat ? { ...x, pick: color } : x)) };
  return next.seats.every((x) => x.pick !== null) ? reveal(next, now) : next;
}

/** The current phase's time is up: move to the next one. */
export function advance(s: ServerState, now: number): ServerState {
  switch (s.phase) {
    case "show":
      return { ...s, phase: "answer", endsAt: now + TIMING.answerMs };
    case "answer":
      return reveal(s, now);
    case "reveal":
      return s.round + 1 >= ROUNDS
        ? { ...s, phase: "over", endsAt: null }
        : beginRound(s, s.round + 1, now);
    default:
      return s;
  }
}

export const due = (s: ServerState, now: number) => s.endsAt !== null && now >= s.endsAt;
