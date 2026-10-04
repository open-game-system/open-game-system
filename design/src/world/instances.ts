// What the games' servers report (Tier 2) or what OGS-hosted saves hold (Tier 1).
// Status vocabulary from the brief: lobby → active ⇄ suspended → completed | expired, plus waiting.
import { person } from "./family";

export type InstanceStatus = "lobby" | "active" | "suspended" | "waiting" | "completed" | "expired";

export interface Seat {
  /** A seat is one person or a whole household. */
  label: string;
  householdId: string;
  personIds: string[];
  color: string;
  score?: number;
  online?: boolean;
}

export interface Instance {
  id: string;
  gameId: string;
  status: InstanceStatus;
  /** One line the game writes, e.g. "Mission 6 · Navigator rank". */
  title: string;
  detail: string;
  seats: Seat[];
  /** Whose move it is (seat label), for live/async games. */
  turn?: string;
  yourTurn?: boolean;
  updatedAt: string; // ISO
  resumeUrl: string;
  /** Tier 1 save slot (household × game), if the game uses OGS saves. */
  save?: { version: number; summary: string; bytes: number };
}

const H = "hh-mumm";

/** Couch games: one save slot per household × game, plus an optional resume point. */
export const COUCH: Instance[] = [
  {
    id: "rc-1",
    gameId: "rocket-crew",
    status: "active",
    title: "Mission 6 · Navigator rank",
    detail: "Heading for Chilly Island · 2 of 3 stars so far",
    seats: [
      { label: "Captain", householdId: H, personIds: ["dad"], color: "#2f6fc8" },
      { label: "Fixer", householdId: H, personIds: ["juneau"], color: "#e08a1e" },
    ],
    updatedAt: "2026-10-03T19:02:00-07:00",
    resumeUrl: "https://rocket-crew.jonathanrmumm.workers.dev/?resume=rc-1",
    save: { version: 3, summary: "Navigator · 14 planets · paint: Bubblegum", bytes: 2140 },
  },
  {
    id: "bs-1",
    gameId: "bake-shop",
    status: "suspended",
    title: "Day 4 · 3 of 5 orders baked",
    detail: "Paused Tuesday · Mrs. Bear is waiting for a strawberry cupcake",
    seats: [
      { label: "Order reader", householdId: H, personIds: ["mom"], color: "#c8412f" },
      { label: "Baker", householdId: H, personIds: ["juneau"], color: "#e08a1e" },
      { label: "Littlest helper", householdId: H, personIds: ["ava"], color: "#9b5fc0" },
    ],
    updatedAt: "2026-09-29T18:41:00-07:00",
    resumeUrl: "https://bake-shop.jonathanrmumm.workers.dev/?resume=bs-1",
    save: { version: 2, summary: "Day 4 · recipe book 11 pages · 3 customers' favourites", bytes: 1880 },
  },
  {
    id: "sn-1",
    gameId: "story-nook",
    status: "completed",
    title: "Juneau's character is ready",
    detail: "Ember the dragon finished painting overnight · 6 books on the shelf",
    seats: [
      { label: "Reader", householdId: H, personIds: ["dad"], color: "#2f6fc8" },
      { label: "Story maker", householdId: H, personIds: ["juneau"], color: "#e08a1e" },
    ],
    updatedAt: "2026-10-03T07:15:00-07:00",
    resumeUrl: "https://story-nook.jonathanrmumm.workers.dev/",
    save: { version: 5, summary: "6 books · Ember (Juneau) · Dot (Ava)", bytes: 5230 },
  },
  {
    id: "pg-1",
    gameId: "peekaboo-garden",
    status: "completed",
    title: "Meadow · 9 of 12 critters found",
    detail: "A hedgehog moved into the pond garden",
    seats: [],
    updatedAt: "2026-10-02T17:30:00-07:00",
    resumeUrl: "https://peekaboo-garden.jonathanrmumm.workers.dev/",
  },
  {
    id: "nf-1",
    gameId: "night-flight",
    status: "completed",
    title: "4 nights flown home",
    detail: "Next: 6 owls · a new nest decoration at 5 wins",
    seats: [],
    updatedAt: "2026-09-28T19:20:00-07:00",
    resumeUrl: "https://night-flight.jonathanrmumm.workers.dev/",
  },
];

/** Hearthisle game night: three homes, paused at turn 14 last Friday. */
export const HEARTHISLE: Instance = {
  id: "hi-1",
  gameId: "hearthisle",
  status: "suspended",
  title: "Game night · turn 14",
  detail: "Paused Friday 9:52 pm · Okafors lead 7–6–5 · Nana & Pop to roll",
  seats: [
    { label: "Mumms (Jonathan + Juneau)", householdId: "hh-mumm", personIds: ["dad", "juneau"], color: "#2f6fc8", score: 6, online: true },
    { label: "Okafors", householdId: "hh-okafor", personIds: ["tunde", "ada", "kemi"], color: "#c8412f", score: 7, online: true },
    { label: "Nana & Pop", householdId: "hh-nana", personIds: ["nana", "pop"], color: "#e08a1e", score: 5, online: false },
  ],
  turn: "Nana & Pop",
  yourTurn: false,
  updatedAt: "2026-09-26T21:52:00-07:00",
  resumeUrl: "https://hearthisle.opengame.org/g/hi-1",
};

export interface DuelGame {
  id: string;
  opponent: string;
  opponentHome: string;
  color: string;
  /** The opponent's sticker: family members reuse their own (family.ts); people outside the three
   * homes picked one of Bake Shop's plush customers. Never an initial in a square. */
  sticker: string;
  status: "waiting" | "yourTurn" | "completed" | "expired" | "invite";
  you: number;
  them: number;
  lastMove: string;
  lastWord?: string;
  updatedAt: string;
}

/** Five open Word Duel games (two your turn), one finished, one expiring. */
export const DUELS: DuelGame[] = [
  { id: "wd-1", opponent: "Nana", opponentHome: "Boise", color: "#b5623c", sticker: person("nana").sticker, status: "yourTurn", you: 212, them: 238, lastMove: "Nana played QUILT for 34", lastWord: "QUILT", updatedAt: "2026-10-03T18:47:00-07:00" },
  { id: "wd-2", opponent: "Mom", opponentHome: "Home", color: "#c8412f", sticker: person("mom").sticker, status: "yourTurn", you: 140, them: 121, lastMove: "Mom played FERN for 18", lastWord: "FERN", updatedAt: "2026-10-03T12:05:00-07:00" },
  { id: "wd-3", opponent: "Tunde", opponentHome: "Seattle", color: "#1f8a5b", sticker: person("tunde").sticker, status: "waiting", you: 301, them: 287, lastMove: "You played ZEBRA for 41", lastWord: "ZEBRA", updatedAt: "2026-10-03T08:30:00-07:00" },
  { id: "wd-4", opponent: "Uncle Rob", opponentHome: "Denver", color: "#5a6b7d", sticker: "/art/bake-shop/char-duck.webp", status: "waiting", you: 88, them: 95, lastMove: "You played OAK for 12", lastWord: "OAK", updatedAt: "2026-10-01T21:14:00-07:00" },
  { id: "wd-5", opponent: "Priya", opponentHome: "Austin", color: "#7b6ad6", sticker: "/art/bake-shop/char-cat.webp", status: "waiting", you: 176, them: 160, lastMove: "You played GLOW for 22 · her move for 2 days", lastWord: "GLOW", updatedAt: "2026-09-30T19:40:00-07:00" },
  { id: "wd-6", opponent: "Ada", opponentHome: "Seattle", color: "#d14d72", sticker: person("ada").sticker, status: "completed", you: 402, them: 377, lastMove: "You won by 25 · final word JINX", lastWord: "JINX", updatedAt: "2026-09-29T22:02:00-07:00" },
  { id: "wd-7", opponent: "Marcus", opponentHome: "Chicago", color: "#1f6f8b", sticker: "/art/bake-shop/char-fox.webp", status: "expired", you: 60, them: 44, lastMove: "No move in 14 days · game closed", updatedAt: "2026-09-21T10:00:00-07:00" },
];

/** World clock: things that happened between sittings. Grown-up phones only, never kid devices. */
export interface WorldEvent {
  id: string;
  gameId: string;
  text: string;
  at: string;
  kind: "ready" | "moved-in" | "your-turn" | "invite" | "reminder";
}

export const WORLD_EVENTS: WorldEvent[] = [
  { id: "we-1", gameId: "story-nook", text: "Juneau's character is ready: Ember the dragon finished painting", at: "2026-10-03T07:15:00-07:00", kind: "ready" },
  { id: "we-2", gameId: "peekaboo-garden", text: "A hedgehog moved into the pond garden", at: "2026-10-02T17:30:00-07:00", kind: "moved-in" },
  { id: "we-3", gameId: "word-duel", text: "Nana played QUILT. Your turn", at: "2026-10-03T18:47:00-07:00", kind: "your-turn" },
  { id: "we-4", gameId: "hearthisle", text: "Game night resumes tonight at 8 · Okafors are in", at: "2026-10-03T17:00:00-07:00", kind: "reminder" },
];
