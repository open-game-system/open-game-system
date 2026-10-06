import type { Store } from "@open-game-system/app-bridge-types";
import type { NativeCastEvents, NativeCastState } from "./cast-store";
import { errorMessage } from "./client-log";

type Tv = { id: string; name: string };

export type SwitchState =
  | { status: "idle" }
  | { status: "switching"; tv: Tv }
  | { status: "failed"; tv: Tv; reason: "no-tv" | "start-failed" | "timeout"; detail?: string }
  | { status: "failed"; tv: Tv; reason: "error"; detail: string };

export type MoveResult = "started" | "no-tv" | "same";

/** How long a switch waits for the new TV's session to connect after Cast accepted the start. */
export const SWITCH_TIMEOUT_MS = 20_000;

/**
 * Remote → TV picker, as the phone shows it. A switch is "switching" from the tap until the new TV
 * is connected (not just until Cast accepted the start), one at a time (a second tap meanwhile is
 * ignored), and a switch that doesn't make it ends "failed" with the TV to retry, kept outside the
 * TV tab's components because the remote unmounts while no TV is cast.
 */
export function createCastSwitch(deps: {
  castStore: Pick<Store<NativeCastState, NativeCastEvents>, "getSnapshot" | "subscribe">;
  timeoutMs?: number;
}) {
  let state: SwitchState = { status: "idle" };
  const listeners = new Set<() => void>();
  const set = (next: SwitchState) => {
    state = next;
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

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async run(tv: Tv, move: () => Promise<MoveResult>): Promise<MoveResult | "busy" | "failed"> {
      if (state.status === "switching") return "busy";
      set({ status: "switching", tv });
      let result: MoveResult;
      try {
        result = await move();
      } catch (err) {
        set({ status: "failed", tv, reason: "error", detail: errorMessage(err) });
        return "failed";
      }
      if (result === "same") {
        set({ status: "idle" });
        return "same";
      }
      if (result === "no-tv") {
        set({ status: "failed", tv, reason: "no-tv" });
        return "failed";
      }
      const outcome = await connected(tv);
      if (outcome === true) {
        set({ status: "idle" });
        return "started";
      }
      set({ status: "failed", tv, ...outcome });
      return "failed";
    },
    /** The failure was seen (the user closed it, or cast another way). */
    dismiss() {
      if (state.status === "failed") set({ status: "idle" });
    },
  };
}

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
