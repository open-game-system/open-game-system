import type { Store } from "@open-game-system/app-bridge-types";
import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { NativeCastEvents, NativeCastState } from "./cast-store";
import { errorMessage } from "./client-log";

type Tv = { id: string; name: string };

export type SwitchState =
  | { status: "idle" }
  | { status: "switching"; tv: Tv }
  | { status: "failed"; tv: Tv; reason: "no-tv" | "start-failed" | "timeout"; detail?: string }
  | { status: "failed"; tv: Tv; reason: "error"; detail: string };

export type MoveResult = "started" | "no-tv" | "same";
/** What became of one pick: its switch's outcome, or "superseded" by a later pick. */
export type RunResult = MoveResult | "failed" | "superseded";

/** How long a switch waits for the new TV's session to connect after Cast accepted the start. */
export const SWITCH_TIMEOUT_MS = 20_000;

/** A TV picked in the picker, and every tap waiting on what becomes of it. */
type Choice = {
  tv: Tv;
  move: () => Promise<MoveResult>;
  waiting: ((r: RunResult) => void)[];
};

/** How one switch ended: its result, and the state it leaves. */
type Ending = { result: MoveResult | "failed"; state: SwitchState };

/**
 * Remote → TV picker, as the phone shows it. A switch is "switching" from the tap until the new TV
 * is connected (not just until Cast accepted the start), and a switch that doesn't make it ends
 * "failed" with the TV to retry, kept outside the TV tab's components because the remote unmounts
 * while no TV is cast. One switch at a time, and the last tap wins (owner, 2026-10-06): a TV picked
 * while a switch runs is next once that switch finishes (connected or not), replacing any pick
 * before it; picking the TV being switched to again drops the pick in between.
 */
export function createCastSwitch(deps: {
  castStore: Pick<Store<NativeCastState, NativeCastEvents>, "getSnapshot" | "subscribe">;
  timeoutMs?: number;
  /** A switch ended connected on this TV: the couch session is told its name. */
  onSwitched?: (tv: Tv) => void;
}) {
  let state: SwitchState = { status: "idle" };
  let running: Choice | null = null;
  let next: Choice | null = null;
  const listeners = new Set<() => void>();
  const set = (s: SwitchState) => {
    state = s;
    for (const l of listeners) l();
  };

  /** Resolves once the cast store says the TV is connected (true) or the start failed (detail). */
  function connected(
    tv: Tv,
  ): Promise<true | { reason: "start-failed" | "timeout"; detail?: string }> {
    return new Promise((resolve) => {
      const check = () => {
        const { session, error } = deps.castStore.getSnapshot();
        if (session.status === "connected" && session.deviceId === tv.id) done(true);
        else if (session.status === "disconnected" && error)
          done({ reason: "start-failed", detail: error });
      };
      let settled = false;
      let off: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      function done(v: true | { reason: "start-failed" | "timeout"; detail?: string }) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        off?.();
        resolve(v);
      }
      // The store calls a new listener at once with the current state.
      off = deps.castStore.subscribe(check);
      if (settled) return off();
      timer = setTimeout(() => done({ reason: "timeout" }), deps.timeoutMs ?? SWITCH_TIMEOUT_MS);
    });
  }

  /** One switch, to its end. */
  async function attempt({ tv, move }: Choice): Promise<Ending> {
    let result: MoveResult;
    try {
      result = await move();
    } catch (err) {
      return {
        result: "failed",
        state: { status: "failed", tv, reason: "error", detail: errorMessage(err) },
      };
    }
    if (result === "same") return { result, state: { status: "idle" } };
    if (result === "no-tv")
      return { result: "failed", state: { status: "failed", tv, reason: "no-tv" } };
    const outcome = await connected(tv);
    return outcome === true
      ? { result: "started", state: { status: "idle" } }
      : { result: "failed", state: { status: "failed", tv, ...outcome } };
  }

  /** Runs the picks one after another until the last one has finished. */
  async function drive(first: Choice): Promise<void> {
    let choice: Choice | null = first;
    while (choice) {
      running = choice;
      set({ status: "switching", tv: choice.tv });
      const ending = await attempt(choice);
      const later: Choice | null = next;
      next = null;
      if (later) {
        for (const w of choice.waiting) w("superseded");
        choice = later;
        continue;
      }
      running = null;
      set(ending.state);
      if (ending.result === "started") deps.onSwitched?.(choice.tv);
      for (const w of choice.waiting) w(ending.result);
      choice = null;
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run(tv: Tv, move: () => Promise<MoveResult>): Promise<RunResult> {
      return new Promise((resolve) => {
        if (!running) {
          void drive({ tv, move, waiting: [resolve] });
          return;
        }
        if (next?.tv.id === tv.id) {
          next.waiting.push(resolve);
          return;
        }
        const dropped = next;
        if (running.tv.id === tv.id) {
          // Back to the TV already being switched to: nothing more after it.
          next = null;
          running.waiting.push(resolve);
        } else next = { tv, move, waiting: [resolve] };
        for (const w of dropped?.waiting ?? []) w("superseded");
        set({ status: "switching", tv });
      });
    },
    /** The failure was seen (the user closed it, or cast another way). */
    dismiss() {
      if (state.status === "failed") set({ status: "idle" });
    },
  };
}

/** The TV the cast moved to, for the couch session (null for a name with nothing in it). */
export function tvRename(name: string): Extract<ClientMessage, { type: "tv.rename" }> | null {
  const trimmed = name.trim().slice(0, 60).trim();
  return trimmed ? { type: "tv.rename", name: trimmed } : null;
}

/** onSwitched for the app: the couch session (every phone, the launcher's header) names the new TV. */
export const announceSwitch =
  (send: (msg: ClientMessage) => void) =>
  (tv: Tv): void => {
    const msg = tvRename(tv.name);
    if (msg) send(msg);
  };

/** What the phone says about a failed switch; null otherwise. */
export function switchMessage(state: SwitchState): string | null {
  if (state.status !== "failed") return null;
  const head = `Couldn't switch to ${state.tv.name}.`;
  switch (state.reason) {
    case "no-tv":
      return `${head} Is it on?`;
    case "timeout":
      return `${head} It didn't answer.`;
    default:
      return state.detail ? `${head} ${state.detail}` : head;
  }
}
