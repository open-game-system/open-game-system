// The night as a thread, in words. One pure function turns a logged entry into what a given home's
// phone says about it, so the same thread reads right on our phone and on Nana & Pop's: "You" is
// always the viewer's own home, and our kids are never named to another home unless we chose to.
import { HOME } from "../../../../world";
import { homeName, short, US, whenWords, type Entry, type Night, type NightHome } from "../../nights";

/** Who is looking: a household id. */
export type Viewer = string;

export interface Line {
  /** The household that did it (its crest is the entry's node on the path); null = OGS / the game. */
  home: string | null;
  who: string;
  /** What happened, after the name: "rolled · turn 13". */
  text: string;
  at: string;
  /** A milestone sits on the path as a turn token instead of a crest. */
  turn?: number;
}

export const whoFor = (n: Night, home: string, viewer: Viewer): string => (home === viewer ? "You" : homeName(n, home) || "A home");

const kidName = HOME.people.find((p) => p.id === "juneau")?.name ?? "Juneau";
const dad = HOME.people.find((p) => p.id === "dad")?.name ?? "Jonathan";

/** Our seat(s) as a viewer sees them: we see our own people; others see the household (plus Juneau's name only if we turned it on). */
export function ourSeats(split: boolean, viewer: Viewer, kidNames: boolean): { color: string; word: string; label: string }[] {
  if (viewer === US) {
    return split
      ? [
          { color: "#2f6fc8", word: "Blue", label: dad },
          { color: "#1f8a5b", word: "Green", label: kidName },
        ]
      : [{ color: "#2f6fc8", word: "Blue", label: `${dad} + ${kidName}` }];
  }
  if (split) {
    return [
      { color: "#2f6fc8", word: "Blue", label: kidNames ? `Mumms · ${dad}` : "The Mumms" },
      { color: "#1f8a5b", word: "Green", label: kidNames ? `Mumms · ${kidName}` : "The Mumms" },
    ];
  }
  return [{ color: "#2f6fc8", word: "Blue", label: kidNames ? `The Mumms (${dad}, ${kidName})` : "The Mumms" }];
}

export function seatList(n: Night, split: boolean, viewer: Viewer, kidNames: boolean): { home: NightHome; color: string; word: string; label: string }[] {
  return n.homes
    .filter((h) => h.reply !== "declined")
    .flatMap((h) =>
      h.householdId === US
        ? ourSeats(split, viewer, kidNames).map((x) => ({ home: h, ...x }))
        : [{ home: h, color: h.color, word: `${h.colorName[0]?.toUpperCase() ?? ""}${h.colorName.slice(1)}`, label: h.householdId === viewer ? "You" : h.name }],
    );
}

const playsOn = (e: Extract<Entry, { kind: "reply" }>, viewer: Viewer): string => {
  const their = e.home === viewer ? "your" : "their";
  return e.screen === "tv" ? `on ${their} own TV` : `on ${their} phones, no TV needed`;
};

/** One entry, as the viewer's phone says it. Day separators are rendered separately. */
export function lineOf(e: Exclude<Entry, { kind: "day" }>, n: Night, viewer: Viewer): Line {
  switch (e.kind) {
    case "invite":
      return { home: e.by, who: whoFor(n, e.by, viewer), text: `invited ${e.to.length === 1 ? "one home" : `${e.to.length} homes`}`, at: e.at };
    case "reply":
      return { home: e.home, who: whoFor(n, e.home, viewer), text: e.reply === "in" ? `are in · ${playsOn(e, viewer)}` : `can't make it ${whenWords(n.when)}`, at: e.at };
    case "seats":
      return { home: e.by, who: whoFor(n, e.by, viewer), text: "picked seats", at: e.at };
    case "start":
      return { home: null, who: "Game on", text: "turn 1 · the board opened in every home", at: e.at, turn: 1 };
    case "roll":
      return { home: e.home, who: whoFor(n, e.home, viewer), text: `rolled · turn ${e.turn}`, at: e.at };
    case "pause":
      return { home: e.by, who: whoFor(n, e.by, viewer), text: `paused at turn ${e.turn}, for every home`, at: e.at, turn: e.turn };
    case "next":
      return { home: e.by, who: whoFor(n, e.by, viewer), text: `set the next sitting`, at: e.at };
    case "here":
      return { home: e.home, who: whoFor(n, e.home, viewer), text: "are here for tonight", at: e.at };
    case "resume":
      return { home: null, who: `Turn ${e.turn} picked up`, text: "every home is here, the board opened where it stopped", at: e.at, turn: e.turn };
    case "note":
      return { home: e.by, who: whoFor(n, e.by, viewer), text: e.text, at: e.at };
  }
}

/** What's happening right now, at the foot of the thread (not logged: it changes as you look). */
export interface Now {
  home: string;
  kind: "deciding" | "away" | "rolling" | "yours";
  text: string;
}

export function nowOf(n: Night, viewer: Viewer): Now[] {
  if (n.status === "setup") return n.homes.filter((h) => h.reply === "invited").map((h) => ({ home: h.householdId, kind: "deciding", text: h.householdId === viewer ? "Your answer" : `${h.name} · deciding` }));
  if (n.status === "paused") return n.homes.filter((h) => !h.back && h.reply !== "declined").map((h) => ({ home: h.householdId, kind: "away", text: `${whoFor(n, h.householdId, viewer)} aren't here yet` }));
  if (n.status === "live") {
    const mine = n.turnOf === viewer;
    return [{ home: n.turnOf, kind: mine ? "yours" : "rolling", text: mine ? `Your roll · turn ${n.turn}` : `${short(homeName(n, n.turnOf))} rolling · turn ${n.turn}` }];
  }
  return [];
}

/** What other homes see of us, in one line (the thread's pinned header). */
export const seenAs = (kidNames: boolean, split: boolean): string =>
  ourSeats(split, "other", kidNames)
    .map((x) => `${x.label} · ${x.word.toLowerCase()} seat`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" and ");
