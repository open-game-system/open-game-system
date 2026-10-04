// Game nights: one live game across several homes (Hearthisle). The couch is one home's TV
// tonight; a game night is a standing table that several homes come back to. Each home has a seat
// (the whole household, or split), a screen (its own TV, or phones only), and a reply to the invite.
// Other homes see a household by its name and seat colour, never our kids' names or pictures
// unless we choose to show them.
import { HEARTHISLE, HOUSEHOLDS, type Household } from "../../world";
import { st, type Status } from "./status";

export type NightScreen = "tv" | "phones";
export type Reply = "host" | "in" | "invited" | "declined";
export type NightStatus = "setup" | "lobby" | "live" | "paused";
export type NightStep = "detail" | "invite" | "seats" | "where";

/**
 * The night is one thread among its homes: every reply, seat pick, roll, pause and "back at 8:00"
 * is an entry in one timeline, in the order it happened. The game reports rolls; OGS writes the rest.
 * Entries name homes, never people outside our own home (kids appear only as their home's crest).
 */
export type Entry =
  | { kind: "day"; label: string }
  | { kind: "invite"; at: string; by: string; when: string; to: string[] }
  | { kind: "reply"; at: string; home: string; reply: "in" | "declined"; screen: NightScreen }
  | { kind: "seats"; at: string; by: string; split: boolean }
  | { kind: "start"; at: string }
  | { kind: "roll"; at: string; home: string; turn: number }
  | { kind: "pause"; at: string; by: string; turn: number }
  | { kind: "next"; at: string; by: string; when: string }
  | { kind: "here"; at: string; home: string }
  | { kind: "resume"; at: string; turn: number }
  | { kind: "note"; at: string; by: string; text: string };

export interface NightHome {
  householdId: string;
  /** The name every home sees: "The Mumms". */
  name: string;
  color: string;
  colorName: string;
  /** "together": one seat for the household; "split": a kid gets their own seat. */
  seat: "together" | "split";
  screen: NightScreen;
  reply: Reply;
  /** Online right now (a paused night resumes when every home is back). */
  back: boolean;
  score: number;
}

export interface Night {
  id: string;
  gameId: string;
  status: NightStatus;
  turn: number;
  /** Household whose move it is. */
  turnOf: string;
  /** Next sitting, if one is set: "Tonight 8:00". */
  when: string | null;
  /** Day it was paused: "Fri". */
  pausedOn: string | null;
  /** The home that paused it last (a pause stops the board for every home). */
  pausedBy: string | null;
  homes: NightHome[];
  /** The thread: everything that happened at this table, oldest first. */
  log: Entry[];
}

export interface Nights {
  list: Night[];
  open: string | null;
  step: NightStep;
  /** Homes ticked on the invite screen. */
  picked: string[];
  /** "See what they see" sheet. */
  preview: boolean;
  /** Show Juneau's name (not his picture) to the other homes. Off by default. */
  kidNames: boolean;
  /** An invite link is out for a free seat (after a home couldn't make it). */
  link: boolean;
}

export const US = "hh-mumm";

const COLOR_NAME: Record<string, string> = { "#2f6fc8": "blue", "#c8412f": "red", "#e08a1e": "amber", "#1f8a5b": "green" };

export const household = (id: string): Household => {
  const h = HOUSEHOLDS.find((x) => x.id === id);
  if (!h) throw new Error(`unknown household ${id}`);
  return h;
};

const screenOf = (h: Household): NightScreen => (h.devices.some((d) => d.kind === "tv" && d.online) ? "tv" : "phones");

/** Turn 14 of the standing Hearthisle night, from what the game reports. */
export function hearthisleNight(): Night {
  return {
    id: HEARTHISLE.id,
    gameId: HEARTHISLE.gameId,
    status: "paused",
    turn: 14,
    turnOf: "hh-nana",
    when: "Tonight 8:00",
    pausedOn: "Fri",
    pausedBy: "hh-okafor",
    homes: HEARTHISLE.seats.map((seat) => {
      const h = household(seat.householdId);
      return {
        householdId: h.id,
        name: h.name,
        color: seat.color,
        colorName: COLOR_NAME[seat.color] ?? "",
        seat: "together",
        screen: screenOf(h),
        reply: h.id === US ? "host" : "in",
        back: h.id !== "hh-nana",
        score: seat.score ?? 0,
      };
    }),
    log: [
      { kind: "day", label: "Last Friday" },
      { kind: "start", at: "8:04 pm" },
      { kind: "roll", at: "9:38 pm", home: US, turn: 12 },
      { kind: "roll", at: "9:49 pm", home: "hh-okafor", turn: 13 },
      { kind: "pause", at: "9:52 pm", by: "hh-okafor", turn: 14 },
      { kind: "day", label: "Saturday" },
      { kind: "next", at: "10:15 am", by: US, when: "Fri 8:00" },
      { kind: "day", label: "Today" },
      { kind: "here", at: "5:00 pm", home: "hh-okafor" },
      { kind: "here", at: "7:02 pm", home: US },
    ],
  };
}

const add = (n: Night, ...e: Entry[]): Night => ({ ...n, log: [...n.log, ...e] });
/** The clock during a sitting: rolls land a few minutes apart from 8:00. */
const atTurn = (turn: number, first: number): string => `8:${String((Math.max(0, turn - first) + 1) * 4).padStart(2, "0")} pm`;

export function baseNights(): Nights {
  return { list: [hearthisleNight()], open: null, step: "detail", picked: ["hh-okafor", "hh-nana"], preview: false, kidNames: false, link: false };
}

export const homeName = (n: Night, id: string): string => n.homes.find((h) => h.householdId === id)?.name ?? "";
export const short = (name: string): string => name.replace(/^The /, "");
/** Our roll in a live night. A paused night waits for every home, so it isn't "your turn" yet. */
export const isOurs = (n: Night): boolean => n.turnOf === US && n.status === "live";
export const everyoneBack = (n: Night): boolean => n.homes.every((h) => h.back || h.reply === "declined");

/** The night's status, in the shared vocabulary (status.ts). A night with a time set is "Coming up". */
export function nightStatus(n: Night, onTv: string | null): Status {
  if (n.status === "live") return onTv === n.gameId ? st("live", "Live") : isOurs(n) ? st("yours", "Your roll") : st("theirs", "Their turn");
  if (n.status === "setup" && n.homes.some((h) => h.reply === "invited")) return st("invited", "Invited");
  if (n.when) return st("coming", n.when);
  return st("paused", `Paused at turn ${n.turn}`);
}

/** One line about where the night stands: "Paused at turn 14 · Nana & Pop to roll". */
export function nightLine(n: Night): string {
  if (n.status === "setup") return "Setting up · new game";
  if (n.status === "lobby") return "New game · everyone's in";
  const who = n.turnOf === US ? "your roll" : `${short(homeName(n, n.turnOf))} to roll`;
  if (n.status === "live") return `Turn ${n.turn} · ${who}`;
  return `Paused at turn ${n.turn} · ${who}`;
}

/** Seat words for a home, as our phone shows them (we see our own people; other homes don't). */
export function seatWords(h: NightHome): string {
  if (h.householdId === US) return h.seat === "together" ? "Jonathan + Juneau share blue" : "Jonathan blue · Juneau green";
  const hh = household(h.householdId);
  return `Whole household · ${hh.people.length} people`;
}

export const screenWords = (h: NightHome): string => {
  if (h.screen === "phones") return "Phones only · no TV";
  const tv = household(h.householdId).devices.find((d) => d.kind === "tv" && d.online);
  return h.householdId === US ? (tv?.name ?? "Living room TV") : "Their own TV";
};

// ---- actions (pure, on Nights) ----

const mapNight = (ns: Nights, id: string, f: (n: Night) => Night): Nights => ({ ...ns, list: ns.list.map((n) => (n.id === id ? f(n) : n)) });
const current = (ns: Nights): Night | undefined => ns.list.find((n) => n.id === ns.open);

export const openNight = (ns: Nights, id: string): Nights => ({ ...ns, open: id, step: "detail", preview: false });

/** A new night while another is paused: the paused one keeps its place and stays in Game nights. */
export const beginNewNight = (ns: Nights): Nights => ({ ...ns, open: null, step: "invite", picked: ["hh-okafor", "hh-nana"], preview: false });

export const togglePick = (ns: Nights, id: string): Nights => ({ ...ns, picked: ns.picked.includes(id) ? ns.picked.filter((x) => x !== id) : [...ns.picked, id] });

export function sendInvites(ns: Nights): Nights {
  const id = `hi-${ns.list.length + 1}`;
  const us = hearthisleNight().homes.find((h) => h.householdId === US);
  if (!us) return ns;
  const others = ns.picked.map((hid): NightHome => {
    const h = household(hid);
    const seat = HEARTHISLE.seats.find((x) => x.householdId === hid);
    const color = seat?.color ?? "#1f8a5b";
    return { householdId: hid, name: h.name, color, colorName: COLOR_NAME[color] ?? "", seat: "together", screen: screenOf(h), reply: "invited", back: true, score: 0 };
  });
  const night: Night = {
    id,
    gameId: "hearthisle",
    status: "setup",
    turn: 0,
    turnOf: "hh-okafor",
    when: "Tonight 8:00",
    pausedOn: null,
    pausedBy: null,
    homes: [{ ...us, score: 0, back: true }, ...others],
    log: [{ kind: "day", label: "Today" }, { kind: "invite", at: "7:10 pm", by: US, when: "Tonight 8:00", to: ns.picked }],
  };
  return { ...ns, list: [...ns.list, night], open: id, step: "invite" };
}

/** The other homes answer (in the prototype, a beat after the invite goes out). */
export const answerInvites = (ns: Nights): Nights => (ns.open ? mapNight(ns, ns.open, (n) => answer(n, () => "in")) : ns);

/** Every invited home answers; each answer lands in the thread with where that home will play. */
function answer(n: Night, pick: (h: NightHome) => "in" | "declined"): Night {
  const replies: Entry[] = n.homes.filter((h) => h.reply === "invited").map((h, i) => ({ kind: "reply", at: `7:1${2 + i} pm`, home: h.householdId, reply: pick(h), screen: h.screen }));
  return add({ ...n, homes: n.homes.map((h) => (h.reply === "invited" ? { ...h, reply: pick(h) } : h)) }, ...replies);
}

/** One home says no; the rest say yes (the prototype's "Nana & Pop can't make it"). */
export const declineHome = (ns: Nights, hid: string): Nights => (ns.open ? mapNight(ns, ns.open, (n) => answer(n, (h) => (h.householdId === hid ? "declined" : "in"))) : ns);

/** Our seat pick goes into the thread; then the night is ready to start. */
export const postSeats = (ns: Nights): Nights =>
  ns.open ? { ...mapNight(ns, ns.open, (n) => add(n, { kind: "seats", at: "7:14 pm", by: US, split: n.homes.some((h) => h.householdId === US && h.seat === "split") })), step: "where" } : ns;

export const toStep = (ns: Nights, step: NightStep): Nights => ({ ...ns, step, preview: false });

export const toggleSplit = (ns: Nights): Nights =>
  ns.open ? mapNight(ns, ns.open, (n) => ({ ...n, homes: n.homes.map((h) => (h.householdId === US ? { ...h, seat: h.seat === "together" ? "split" : "together" } : h)) })) : ns;

export const removeHome = (ns: Nights, hid: string): Nights => (ns.open ? mapNight(ns, ns.open, (n) => ({ ...n, homes: n.homes.filter((h) => h.householdId !== hid) })) : ns);

export const startNight = (ns: Nights): Nights => (ns.open ? mapNight(ns, ns.open, (n) => add({ ...n, status: "live", turn: 1, turnOf: "hh-okafor", when: null }, { kind: "start", at: "8:00 pm" })) : ns);

/** Next night: every home is back, the board comes up where it stopped. */
export const resumeNight = (ns: Nights, id: string): Nights =>
  mapNight(ns, id, (n) => add({ ...arrive(n, "7:58 pm"), status: "live", when: null, pausedOn: null }, { kind: "resume", at: "8:00 pm", turn: n.turn }));

/** Homes that weren't here yet arrive, each as an entry. */
function arrive(n: Night, at: string): Night {
  const late: Entry[] = n.homes.filter((h) => !h.back && h.reply !== "declined").map((h) => ({ kind: "here", at, home: h.householdId }));
  return add({ ...n, homes: n.homes.map((h) => ({ ...h, back: true })) }, ...late);
}

/** Nana & Pop come online (the prototype's stand-in for "they opened the app"). */
export const homesReturn = (ns: Nights, id: string): Nights => mapNight(ns, id, (n) => arrive(n, "7:58 pm"));

/** The turn moves on to the next home in seat order. */
/** The roll moves to the next home at the table. A home that's away (dropped, and the host chose to
 * play on) is skipped: its seat keeps its score and it rejoins on a later turn. */
export const passTurn = (ns: Nights, id: string): Nights =>
  mapNight(ns, id, (n) => {
    const i = n.homes.findIndex((h) => h.householdId === n.turnOf);
    const order = [...n.homes.slice(i + 1), ...n.homes.slice(0, i + 1)];
    const next = order.find((h) => h.back && h.reply !== "declined") ?? order[0];
    return add({ ...n, turn: n.turn + 1, turnOf: next?.householdId ?? n.turnOf }, { kind: "roll", at: atTurn(n.turn, n.turn < 5 ? 1 : 14), home: n.turnOf, turn: n.turn });
  });

/** Pause for tonight: the board stops for every home at once, and the next sitting is set. */
export const pauseNight = (ns: Nights, id: string): Nights =>
  mapNight(ns, id, (n) =>
    add({ ...n, status: "paused", pausedOn: "Fri", pausedBy: US, when: "Next Fri 8:00" }, { kind: "pause", at: "9:30 pm", by: US, turn: n.turn }, { kind: "next", at: "9:30 pm", by: US, when: "Next Fri 8:00" }),
  );

/** The homes a pause stops besides ours (everyone at the table). */
export const otherHomes = (n: Night): NightHome[] => n.homes.filter((h) => h.householdId !== US && h.reply !== "declined");

/** A home said no: play on without them (their seat leaves the board before it starts). */
export const dropDeclined = (ns: Nights): Nights =>
  ns.open
    ? mapNight(ns, ns.open, (n) => {
        const out = n.homes.filter((h) => h.reply === "declined");
        if (out.length === 0) return n;
        const left = n.homes.length - out.length;
        return add({ ...n, homes: n.homes.filter((h) => h.reply !== "declined") }, { kind: "note", at: "7:15 pm", by: US, text: `Playing with ${left} homes tonight. ${out.map((h) => h.name).join(" and ")}'s seat left the board; they can join the next one.` });
      })
    : ns;

/** A home said no: ask everyone for another night instead (the home that declined is asked again). */
export const anotherNight = (ns: Nights, when: string): Nights =>
  ns.open ? mapNight(ns, ns.open, (n) => add({ ...n, when, homes: n.homes.map((h) => (h.reply === "declined" || h.reply === "in" ? { ...h, reply: "invited" } : h)) }, { kind: "next", at: "7:15 pm", by: US, when })) : ns;

/** A home said no: invite someone else by link; whoever opens it takes the free seat. */
export const inviteInstead = (ns: Nights): Nights => {
  const dropped = dropDeclined(ns);
  return { ...(dropped.open ? mapNight(dropped, dropped.open, (n) => add(n, { kind: "note", at: "7:15 pm", by: US, text: "Sent an invite link for the free seat. Whoever opens it shows up here first." })) : dropped), link: true };
};

export const declined = (n: Night): NightHome[] => n.homes.filter((h) => h.reply === "declined");

export const nightOpen = current;

/** A night's time inside a sentence: "tonight 8:00", "next Fri 8:00", "Sat 8:00". */
export const whenWords = (when: string | null): string => (when ?? "tonight").replace(/^Tonight/, "tonight").replace(/^Next/, "next");
