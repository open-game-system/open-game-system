import type { PrivateView, PublicView, RoomContext, ServerState } from "../room.types";
import { ROUNDS, winners } from "./rules";

/**
 * Every screen's view, derived from the room's state after each change. Views are pure, so they
 * are easy to test: nothing secret (caller ids, the answer before the reveal) can leak by accident.
 */
export function publicView(s: ServerState): PublicView {
  const revealed = s.phase === "reveal" || s.phase === "over";
  return {
    roomCode: s.roomCode,
    phase: s.phase,
    round: s.round,
    rounds: ROUNDS,
    endsAt: s.endsAt,
    players: s.seats.map((x) => ({
      seat: x.seat,
      name: x.name,
      score: x.score,
      answered: x.pick !== null,
      correct: revealed ? x.correct : null,
    })),
    shapes: s.phase === "show" ? (s.current?.shapes ?? []) : [],
    reveal: revealed && s.current ? { answer: s.current.answer, counts: s.current.counts } : null,
    winners: s.phase === "over" ? winners(s.seats) : [],
  };
}

export function privateViews(s: ServerState): Record<string, PrivateView> {
  const views: Record<string, PrivateView> = { [s.tvId]: { role: "tv" } };
  s.seats.forEach((x, i) => {
    views[x.callerId] = { role: "player", seat: x.seat, host: i === 0, pick: x.pick };
  });
  return views;
}

export function withViews(server: ServerState): RoomContext {
  return { public: publicView(server), private: privateViews(server), server };
}
