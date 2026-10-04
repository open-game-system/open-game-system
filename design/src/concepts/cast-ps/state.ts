// Session state for the PS5-hub concept: one cast session hosts the launcher and every game.

export type CastState = "none" | "picking" | "no-tv" | "connecting" | "on" | "dropped" | "recasting";

/** Where the launcher's focus ring is: the icon row, the hub's buttons, or its activity cards. */
export type Zone = "row" | "actions" | "cards";

export type TvMode =
  | { kind: "launcher" }
  | { kind: "picker"; gameId: string; fresh: boolean }
  | { kind: "game"; gameId: string }
  | { kind: "control"; gameId: string }
  | { kind: "switching"; from: string; to: string }
  | { kind: "handoff"; duelId: string; played: boolean };

export type PhoneOwner = "dad" | "mom";

export interface S {
  cast: CastState;
  tv: TvMode;
  /** Index of the focused game in the icon row. */
  row: number;
  zone: Zone;
  /** Index within the zone (actions or cards). */
  zi: number;
  /** Focus in the who's-playing picker (people…, Start). */
  pickI: number;
  /** Focus in the control-centre strip (Resume, switch targets…). */
  ccI: number;
  phoneMode: "remote" | "browse";
  /** Who is playing tonight (person ids). Carried across swaps. */
  playing: string[];
  /** Games suspended tonight → the resume point they were saved at. */
  suspended: Record<string, string>;
  /** Whose phone this phone surface is. */
  phone: PhoneOwner;
  /** Who holds the remote right now. */
  remote: PhoneOwner;
  /** The remote phone went to sleep. */
  remoteAsleep: boolean;
  /** Word Duel games played from the TV tonight. */
  duelsPlayed: string[];
  /** A short line the TV shows in its notice corner (never over a running game). */
  notice?: string;
  /** Just cast: nobody has picked anything yet. */
  fresh: boolean;
}

export const base = (over: Partial<S> = {}): S => ({
  cast: "on",
  tv: { kind: "launcher" },
  row: 0,
  zone: "row",
  zi: 0,
  pickI: 0,
  ccI: 1,
  phoneMode: "remote",
  playing: ["dad", "juneau", "ava"],
  suspended: {},
  phone: "dad",
  remote: "dad",
  remoteAsleep: false,
  duelsPlayed: [],
  fresh: false,
  ...over,
});
