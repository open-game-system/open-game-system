import { assign, setup } from "xstate";
import { advance, due, isHost, join, newRoom, pick, start } from "./game/room";
import { withViews } from "./game/views";
import type { RoomContext, RoomEvent, RoomInput, ServerState } from "./room.types";

/** Applies a pure change to the room's state and re-derives every view. */
const change = (fn: (s: ServerState, event: RoomEvent) => ServerState) =>
  assign<RoomContext, RoomEvent, undefined, RoomEvent, never>(({ context, event }) =>
    withViews(fn(context.server, event)),
  );

/**
 * The room: one actor per Durable Object (actor-kit). The xstate states only arm the phase timers;
 * the game itself is the pure functions in game/room.ts.
 *
 * A Durable Object can restart (a deploy, an eviction) and loses pending timers: actor-kit then
 * sends RESUME, which re-enters the current phase and re-arms its timer from the stored deadline.
 * A sleeping room wakes only on a message, so screens also send TICK once a deadline has passed.
 */
export const roomMachine = setup({
  types: {
    context: {} as RoomContext,
    events: {} as RoomEvent,
    input: {} as RoomInput,
  },
  delays: {
    deadline: ({ context }) => Math.max(0, (context.server.endsAt ?? Date.now()) - Date.now()),
  },
  guards: {
    isLobby: ({ context }) => context.server.phase === "lobby",
    isShow: ({ context }) => context.server.phase === "show",
    isAnswer: ({ context }) => context.server.phase === "answer",
    isReveal: ({ context }) => context.server.phase === "reveal",
    isDue: ({ context }) => due(context.server, Date.now()),
    fromHost: ({ context, event }) => "caller" in event && isHost(context.server, event.caller.id),
    fromSystem: ({ event }) => "caller" in event && event.caller.type === "system",
  },
  actions: {
    join: change((s, e) =>
      e.type === "JOIN" ? join(s, { callerId: e.caller.id, name: e.name, ogsId: null }) : s,
    ),
    ogsJoin: change((s, e) =>
      e.type === "OGS_JOIN"
        ? join(s, { callerId: e.caller.id, name: e.profile.name, ogsId: e.profile.id })
        : s,
    ),
    start: change((s, e) => ("caller" in e ? start(s, e.caller.id, Date.now()) : s)),
    pick: change((s, e) => (e.type === "PICK" ? pick(s, e.caller.id, e.color, Date.now()) : s)),
    advance: change((s) => advance(s, Date.now())),
  },
}).createMachine({
  id: "room",
  context: ({ input }) =>
    withViews(
      newRoom({ roomCode: input.id, tvId: input.caller.id, seed: Math.floor(Math.random() * 2 ** 31) }),
    ),
  on: {
    JOIN: { actions: "join" },
    OGS_JOIN: { actions: "ogsJoin" },
    RESUME: { guard: "fromSystem", target: ".route" },
  },
  initial: "route",
  states: {
    /** Goes to the state of the room's phase (after a change or a restart). */
    route: {
      always: [
        { guard: "isLobby", target: "lobby" },
        { guard: "isShow", target: "show" },
        { guard: "isAnswer", target: "answer" },
        { guard: "isReveal", target: "reveal" },
        { target: "over" },
      ],
    },
    lobby: {
      on: { START: { guard: "fromHost", actions: "start", target: "route" } },
    },
    show: {
      after: { deadline: { actions: "advance", target: "route" } },
      on: { TICK: { guard: "isDue", actions: "advance", target: "route" } },
    },
    answer: {
      after: { deadline: { actions: "advance", target: "route" } },
      on: {
        PICK: { actions: "pick", target: "route" },
        TICK: { guard: "isDue", actions: "advance", target: "route" },
      },
    },
    reveal: {
      after: { deadline: { actions: "advance", target: "route" } },
      on: { TICK: { guard: "isDue", actions: "advance", target: "route" } },
    },
    over: {
      on: { START: { guard: "fromHost", actions: "start", target: "route" } },
    },
  },
});
