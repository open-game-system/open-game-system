import type { Manifest } from "@open-game-system/ogs-protocol";
import type { CastDevice } from "../../../services/cast-store";
import { castTarget, type StoppedTv } from "../remote/last-stop";

/**
 * What Play (or Rejoin) does (owner, 2026-10-04: "it should just be Play, and then if they are not
 * already casting, we prompt them to cast"). Cast: start now. Not cast and the game uses the TV:
 * the cast prompt, which offers this phone too when the game can play here. Phone-only: play here.
 */
export type PlayAction =
  | { kind: "start" }
  | { kind: "playOnPhone" }
  | { kind: "promptCast"; phone: boolean };

export function playAction(game: Pick<Manifest, "tv">, cast: boolean): PlayAction {
  if (game.tv === "none") return { kind: "playOnPhone" };
  if (cast) return { kind: "start" };
  return { kind: "promptCast", phone: game.tv === "optional" };
}

/** The primary button's word for a game: Rejoin a sitting you're in, else Play. */
export const playVerb = (hasSitting: boolean): "Rejoin" | "Play" =>
  hasSitting ? "Rejoin" : "Play";

/** What the cast prompt shows: the TVs to pick from, "Looking for TVs…", or no TV found. */
export type CastPromptView =
  | { kind: "choose"; devices: CastDevice[]; target: CastDevice }
  | { kind: "looking" }
  | { kind: "noTv" };

export function castPromptView(input: {
  devices: CastDevice[];
  searching: boolean;
  picked: CastDevice | null;
  stopped: StoppedTv | null;
}): CastPromptView {
  const target = castTarget(input.devices, input.picked, input.stopped);
  if (target) return { kind: "choose", devices: input.devices, target };
  return input.searching ? { kind: "looking" } : { kind: "noTv" };
}

/** How long Cast waits for the TV to show the OGS launcher before it gives up. */
export const CAST_WAIT_MS = 8000;

/** Cast, then play: cast the launcher to `tv`, wait until the TV is cast through OGS, then play. */
export async function castAndPlay(
  tv: CastDevice,
  deps: {
    castNow: (tv: CastDevice) => Promise<"started" | "no-tv">;
    waitForCast: (ms: number) => Promise<boolean>;
    play: () => void;
  },
): Promise<"played" | "no-answer"> {
  const result = await deps.castNow(tv);
  if (result !== "started" || !(await deps.waitForCast(CAST_WAIT_MS))) return "no-answer";
  deps.play();
  return "played";
}

/** A Play that needs the TV: which game, whether it can play here instead, and how to play it. */
export interface CastPromptRequest {
  game: Pick<Manifest, "name">;
  phone: boolean;
  play: () => void;
}

/** The app's one cast prompt: any Play asks it, the sheet mounted over the tabs shows it. */
export function createCastPrompt() {
  let current: CastPromptRequest | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    get: (): CastPromptRequest | null => current,
    ask(request: CastPromptRequest) {
      current = request;
      emit();
    },
    dismiss() {
      if (!current) return;
      current = null;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const castPrompt = createCastPrompt();
