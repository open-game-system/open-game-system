import type { ActorKitStorage } from "actor-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, SimulatedClock } from "xstate";
import { ROUNDS, TIMING } from "./game/rules";
import { roomMachine } from "./room.machine";
import type { RoomClientEvent, RoomInput } from "./room.types";

const T0 = 1_700_000_000_000;
/**
 * The machine never touches storage, but actor-kit's input type names a whole DurableObjectStorage.
 * The one cast in the game, kept to this test fake.
 */
const storage = {} as unknown as ActorKitStorage;
const input: RoomInput = {
  id: "ABCD",
  caller: { id: "tv", type: "client" },
  env: { ACTOR_KIT_SECRET: "test" },
  storage,
};

function rig() {
  const clock = new SimulatedClock();
  const actor = createActor(roomMachine, { clock, input }).start();
  const send = (callerId: string, event: RoomClientEvent) =>
    actor.send({ ...event, caller: { id: callerId, type: "client" }, env: input.env, storage });
  /** Moves both clocks: xstate's timers and Date.now(). */
  const wait = (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
    clock.increment(ms);
  };
  const view = () => actor.getSnapshot().context.public;
  return { actor, clock, send, wait, view };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("room machine", () => {
  it("plays a whole game on its timers", () => {
    const { send, wait, view } = rig();
    send("a", { type: "JOIN", name: "Ana" });
    send("b", { type: "JOIN", name: "Bo" });
    send("a", { type: "START" });
    for (let r = 0; r < ROUNDS; r++) {
      expect(view()).toMatchObject({ phase: "show", round: r });
      wait(TIMING.showMs);
      expect(view().phase).toBe("answer");
      wait(TIMING.answerMs);
      expect(view().phase).toBe("reveal");
      wait(TIMING.revealMs);
    }
    expect(view().phase).toBe("over");
  });

  it("reveals as soon as everyone has picked", () => {
    const { actor, send, wait, view } = rig();
    send("a", { type: "JOIN", name: "Ana" });
    send("a", { type: "START" });
    wait(TIMING.showMs);
    const answer = actor.getSnapshot().context.server.current?.answer ?? "coral";
    send("a", { type: "PICK", color: answer });
    expect(view().phase).toBe("reveal");
    expect(view().players[0]?.score).toBe(1);
  });

  it("only the host starts", () => {
    const { send, view } = rig();
    send("a", { type: "JOIN", name: "Ana" });
    send("b", { type: "JOIN", name: "Bo" });
    send("b", { type: "START" });
    expect(view().phase).toBe("lobby");
  });

  it("a TICK after the deadline moves on (a sleeping room that lost its timer)", () => {
    const { send, view } = rig();
    send("a", { type: "JOIN" });
    send("a", { type: "START" });
    send("a", { type: "TICK" });
    expect(view().phase).toBe("show");
    // Time passes with no timer firing (the Durable Object slept).
    vi.setSystemTime(Date.now() + TIMING.showMs + 10);
    send("a", { type: "TICK" });
    expect(view().phase).toBe("answer");
  });

  it("after a restart (RESUME) the phase timer is armed again from the stored deadline", () => {
    const first = rig();
    first.send("a", { type: "JOIN" });
    first.send("a", { type: "START" });
    first.wait(1000);
    const persisted = first.actor.getPersistedSnapshot();
    first.actor.stop();

    const clock = new SimulatedClock();
    const restored = createActor(roomMachine, { clock, input, snapshot: persisted }).start();
    restored.send({ type: "RESUME", caller: { id: "system", type: "system" }, env: input.env, storage });
    vi.setSystemTime(Date.now() + TIMING.showMs - 1000);
    clock.increment(TIMING.showMs - 1000);
    expect(restored.getSnapshot().context.public.phase).toBe("answer");
  });
});
