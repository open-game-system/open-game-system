// Failure & edge states (flow 9), owned by the edge owner.
//
// The model every screen here is designed to: the couch session lives in OGS's cloud, not on any
// device. So every fault is "a device lost the session", never "the session is gone":
// - The TV is a fresh cloud browser per cast. Re-casting starts a new one at the game's resume point.
// - Any grown-up phone in the household can pick up the remote. Nothing restarts.
// - A kid iPad is paired to a person; it rejoins its seat by itself.
// - Resume points come from the game (Tier 1 saves / Tier 2 reports), stored by OGS.
// - A game night lives on the game's server; each home is a seat that can drop and come back.

export type FaultKind =
  | "cast-lost" // the Chromecast dropped the cast mid-mission
  | "stream-stall" // the cloud renderer froze or crashed
  | "remote-dies" // the phone holding the remote went dark
  | "ipad-offline" // a kid iPad lost Wi-Fi mid-game
  | "save-conflict" // the game's save PUT came back 409: two phones saved the same slot differently
  | "home-drops" // another home went offline mid game night
  | "invite-expired" // a game-night link opened after it expired
  | "game-down" // a game's start URL failed
  | "no-tv"; // starting tonight, the living room TV can't be found

/**
 * - armed: everything is fine; the fault arrives on its own a beat later (flows only).
 * - now: it just happened. - recovering: the one recovery action is running.
 * - recovered: back, with the resume point shown. - undone: a recovery choice reversed.
 */
export type FaultPhase = "armed" | "now" | "recovering" | "recovered" | "undone";

/** Which version of a conflicted save the family kept. */
export type SaveChoice = "tonight" | "tuesday";
/** What the hosting home decided when another home dropped. */
export type NightChoice = "wait" | "play-on";

export interface Fault {
  kind: FaultKind;
  /** Which device or home the fault is about (a device id, a household id), if any. */
  subject?: string;
  phase: FaultPhase;
  /** Whose phone the phone surface is, when it isn't Jonathan's ("mom", "nana", "tunde"). */
  viewer?: string;
  /** Save conflict: the version picked (selected before keeping it). */
  save?: SaveChoice;
  /** Home drops: what the host decided. */
  night?: NightChoice;
}

export const fault = (kind: FaultKind, phase: FaultPhase, extra: Omit<Fault, "kind" | "phase"> = {}): Fault => ({ kind, phase, ...extra });

/** The next phase of the simulated world for a fault, and after how long (ms); null = it waits for a person. */
export function nextBeat(f: Fault): { after: number; to: FaultPhase | "clear" } | null {
  if (f.phase === "armed") return { after: 1400, to: "now" };
  // Once it's handled, the note stays a beat and then gets out of the way (an expired invite's
  // answer stays: nothing is running behind it).
  if ((f.phase === "recovered" || f.phase === "undone") && f.kind !== "invite-expired") return { after: 4600, to: "clear" };
  switch (f.kind) {
    case "stream-stall":
      // OGS restarts the picture by itself after a few frozen seconds; the phone can skip the wait.
      if (f.phase === "now") return { after: 9000, to: "recovering" };
      if (f.phase === "recovering") return { after: 2600, to: "recovered" };
      return null;
    case "cast-lost":
      if (f.phase === "recovering") return { after: 2600, to: "recovered" };
      return null;
    case "remote-dies":
      // "recovering" is the offer on Mom's phone: it waits for her.
      return null;
    case "ipad-offline":
      // Wi-Fi comes back by itself; the iPad drops straight into the seat it kept.
      if (f.phase === "now") return { after: 3600, to: "recovering" };
      if (f.phase === "recovering") return { after: 1800, to: "recovered" };
      return null;
    case "home-drops":
      if (f.phase === "recovering") return { after: 3200, to: "recovered" };
      return null;
    case "save-conflict":
    case "game-down":
    case "no-tv":
      if (f.phase === "recovering") return { after: 2200, to: "recovered" };
      return null;
    case "invite-expired":
      if (f.phase === "recovering") return { after: 1200, to: "recovered" };
      return null;
  }
}
