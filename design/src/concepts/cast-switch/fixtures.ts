// Stand-ins for what each game's OWN controller pages would show (the game ships these pages; OGS only
// frames them with its Home button). Test fixtures, not OGS app logic: OGS never branches on a game id.

export type Glyph = "bolt" | "gear" | "star" | "berry" | "swirl" | "sprinkle" | "spoon" | "moon" | "leaf" | "drop";

export interface PhonePage {
  status: string;
  prompt: string;
  actions: string[];
  big: string;
}

export const PHONE_PAGES: Record<string, PhonePage> = {
  "rocket-crew": { status: "Mission 6 · Chilly Island · 2 of 3 stars", prompt: "Steer around the ice moons. Call the Fixer when a light blinks.", actions: ["Steer left", "Steer right"], big: "Boost" },
  "bake-shop": { status: "Day 4 · order 4 of 5", prompt: "Mrs. Bear would like a strawberry cupcake with cream on top.", actions: ["Read it again", "Next order"], big: "Ring the bell" },
  "story-nook": { status: "Book 7 · page 1", prompt: "Once upon a time, Ember the dragon found a door in the hill.", actions: ["Back a page", "Next page"], big: "Read aloud" },
  "peekaboo-garden": { status: "Meadow · 9 of 12 found", prompt: "Someone is hiding near the pond. Count to three together.", actions: ["Give a hint", "New spot"], big: "Peek!" },
  "night-flight": { status: "Night 5 · 3 owls home", prompt: "Call out the stone colour the owl is looking for.", actions: ["Slower", "Faster"], big: "Fly" },
  hearthisle: { status: "Turn 14 · Nana & Pop to roll", prompt: "Your hand: 2 wood, 1 wheat, 1 clay.", actions: ["Trade", "Build"], big: "End turn" },
};

/** Kid pads: wordless shapes in the game's own palette. */
export const KID_PADS: Record<string, { kid: Glyph[]; little: Glyph }> = {
  "rocket-crew": { kid: ["bolt", "gear", "star"], little: "star" },
  "bake-shop": { kid: ["berry", "swirl", "sprinkle"], little: "spoon" },
  "story-nook": { kid: ["moon", "star", "leaf"], little: "moon" },
  "peekaboo-garden": { kid: ["leaf", "drop", "star"], little: "leaf" },
  "night-flight": { kid: ["moon", "star", "drop"], little: "star" },
  hearthisle: { kid: ["leaf", "drop", "gear"], little: "leaf" },
};

export const DEFAULT_PAD: { kid: Glyph[]; little: Glyph } = { kid: ["star", "drop", "leaf"], little: "star" };
