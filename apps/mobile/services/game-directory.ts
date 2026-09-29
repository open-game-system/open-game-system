export interface GameDirectoryEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  iconColor: string;
  iconBgColor: string;
  iconInitials: string;
  tags: string[];
  features: ("push" | "cast" | "activity")[];
}

/**
 * Static game directory shipped with the app.
 * Will be replaced with a remote API later.
 */
export const GAME_DIRECTORY: readonly GameDirectoryEntry[] = [
  {
    id: "rocket-crew",
    name: "Rocket Crew",
    description: "Co-op space repairs for a grown-up and a kid",
    // Inside the OGS app, Rocket Crew's start page hands off to /host (the phone hosts; the TV is cast).
    url: "https://rocket-crew.jonathanrmumm.workers.dev",
    iconColor: "#FDE68A",
    iconBgColor: "#3B1D5E",
    iconInitials: "RC",
    tags: ["Co-op", "Family", "Castable"],
    features: ["cast"],
  },
  {
    id: "trivia-jam",
    name: "Trivia Jam",
    description: "Live multiplayer trivia with friends",
    url: "https://triviajam.tv",
    iconColor: "#A855F6",
    iconBgColor: "#2D1B69",
    iconInitials: "TJ",
    tags: ["Multiplayer", "Trivia", "Live", "Castable"],
    features: ["push", "cast", "activity"],
  },
  {
    id: "chess-online",
    name: "Chess Online",
    description: "Turn-based classic chess",
    url: "https://chessonline.io",
    iconColor: "#4ADE80",
    iconBgColor: "#1B3D2A",
    iconInitials: "CH",
    tags: ["Turn-based", "Strategy", "Castable"],
    features: ["push", "cast"],
  },
  {
    id: "block-puzzle",
    name: "Block Puzzle",
    description: "Relaxing spatial puzzles",
    url: "https://blockpuzzle.game",
    iconColor: "#FB923C",
    iconBgColor: "#3D2B1B",
    iconInitials: "PZ",
    tags: ["Puzzle", "Single Player"],
    features: ["push"],
  },
  {
    id: "word-duel",
    name: "Word Duel",
    description: "Competitive word game",
    url: "https://wordduel.io",
    iconColor: "#38BDF8",
    iconBgColor: "#1B2D3D",
    iconInitials: "WD",
    tags: ["Multiplayer", "Words"],
    features: ["push"],
  },
] as const;

export function findGameById(id: string): GameDirectoryEntry | undefined {
  return GAME_DIRECTORY.find((g) => g.id === id);
}

export function findGameByUrl(url: string): GameDirectoryEntry | undefined {
  return GAME_DIRECTORY.find((g) => url.startsWith(g.url));
}
