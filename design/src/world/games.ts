// The game library, written as the Tier 0 manifests a game would actually ship.
// Adding a game = adding a manifest. Nothing in a concept may special-case a game id.

export type GameShape = "couch" | "live" | "async";
export type Tier = 0 | 1 | 2;

export interface Role {
  id: string;
  /** Who plays it: grown-ups read, kids get a no-words surface. */
  audience: "grownup" | "kid" | "little";
  label: string;
}

export interface GameManifest {
  id: string;
  name: string;
  tagline: string;
  shape: GameShape;
  tier: Tier;
  /** One sitting, in minutes. */
  minutes: [number, number];
  ages: string;
  players: string;
  roles: Role[];
  startUrl: string;
  tvUrl?: string;
  /** Art direction, from the game's own repo. Concepts must use these, not a house palette. */
  palette: { ground: string; ink: string; accent: string; accent2: string };
  art: { tv: string; alt?: string; extra?: Record<string, string> };
  /** The game's own one-line art direction, for concept agents. */
  look: string;
}

export const GAMES: GameManifest[] = [
  {
    id: "rocket-crew",
    name: "Rocket Crew",
    tagline: "Fly the rocket together",
    shape: "couch",
    tier: 2,
    minutes: [8, 12],
    ages: "4+",
    players: "1 grown-up + 1–2 kids",
    roles: [
      { id: "captain", audience: "grownup", label: "Captain" },
      { id: "fixer", audience: "kid", label: "Fixer" },
    ],
    startUrl: "https://rocket-crew.jonathanrmumm.workers.dev/",
    tvUrl: "https://rocket-crew.jonathanrmumm.workers.dev/tv",
    palette: { ground: "#1b0f3a", ink: "#fff6e0", accent: "#ff5fa2", accent2: "#ffd23f" },
    art: { tv: "/art/rocket-crew/tv.jpg", alt: "/art/rocket-crew/alt.jpg", extra: { launch: "/art/rocket-crew/launch.jpg" } },
    look: "Violet nebula space, glossy toy rocket (white + bubblegum pink), chunky arcade display type, gold stars.",
  },
  {
    id: "bake-shop",
    name: "Bake Shop",
    tagline: "Bake what the customers dream of",
    shape: "couch",
    tier: 1,
    minutes: [10, 15],
    ages: "3+",
    players: "1–2 grown-ups + 1–2 kids",
    roles: [
      { id: "reader", audience: "grownup", label: "Order reader" },
      { id: "baker", audience: "kid", label: "Baker" },
      { id: "helper", audience: "little", label: "Littlest helper" },
    ],
    startUrl: "https://bake-shop.jonathanrmumm.workers.dev/",
    tvUrl: "https://bake-shop.jonathanrmumm.workers.dev/tv",
    palette: { ground: "#fff1d6", ink: "#6b3a22", accent: "#f46a8e", accent2: "#8fddbe" },
    art: { tv: "/art/bake-shop/tv.jpg", alt: "/art/bake-shop/alt.jpg", extra: { bunny: "/art/bake-shop/char-bunny.webp", bear: "/art/bake-shop/char-bear.webp" } },
    look: "Soft toy diorama bakery, late-afternoon window light, butter cream + strawberry + mint, plush customers.",
  },
  {
    id: "story-nook",
    name: "Story Nook",
    tagline: "A bedtime story you make together",
    shape: "couch",
    tier: 1,
    minutes: [10, 14],
    ages: "2+",
    players: "1 grown-up + 1–2 kids",
    roles: [
      { id: "reader", audience: "grownup", label: "Reader" },
      { id: "kid", audience: "kid", label: "Story maker" },
      { id: "little", audience: "little", label: "Sleepy helper" },
    ],
    startUrl: "https://story-nook.jonathanrmumm.workers.dev/",
    tvUrl: "https://story-nook.jonathanrmumm.workers.dev/tv",
    palette: { ground: "#2b2550", ink: "#fbefd5", accent: "#f3b664", accent2: "#c9a7e8" },
    art: {
      tv: "/art/story-nook/tv.jpg",
      alt: "/art/story-nook/alt.jpg",
      extra: { journey: "/art/story-nook/journey.jpg", dragon: "/art/story-nook/char-dragon.webp", dinosaur: "/art/story-nook/char-dinosaur.webp", dinoSleep: "/art/story-nook/char-dinosaur-sleep.webp", owl: "/art/story-nook/char-owl.webp", turtle: "/art/story-nook/char-turtle.webp", bear: "/art/story-nook/char-bear.webp" },
    },
    look: "Cut-paper pop-up storybook at dusk: indigo night, honey lamplight, white die-cut borders, serif storybook type.",
  },
  {
    id: "peekaboo-garden",
    name: "Peekaboo Garden",
    tagline: "Find who's hiding",
    shape: "couch",
    tier: 0,
    minutes: [5, 10],
    ages: "2+",
    players: "1 grown-up + 1–2 kids",
    roles: [
      { id: "guide", audience: "grownup", label: "Guide" },
      { id: "finder", audience: "kid", label: "Finder" },
      { id: "little", audience: "little", label: "Little sister" },
    ],
    startUrl: "https://peekaboo-garden.jonathanrmumm.workers.dev/",
    tvUrl: "https://peekaboo-garden.jonathanrmumm.workers.dev/tv",
    palette: { ground: "#3f7d2b", ink: "#fffbe8", accent: "#f3c94f", accent2: "#e0775a" },
    art: { tv: "/art/peekaboo-garden/tv.jpg", alt: "/art/peekaboo-garden/alt.jpg", extra: { frog: "/art/peekaboo-garden/frog.jpg" } },
    look: "Painted clay-toy garden diorama, late sun from upper left, lush greens, buttercup accents.",
  },
  {
    id: "night-flight",
    name: "Night Flight",
    tagline: "Fly the owls home before sunrise",
    shape: "couch",
    tier: 2,
    minutes: [8, 12],
    ages: "4+",
    players: "1–2 grown-ups + 1–2 kids",
    roles: [
      { id: "grownup", audience: "grownup", label: "Grown-up" },
      { id: "kid", audience: "kid", label: "Owl friend" },
    ],
    startUrl: "https://night-flight.jonathanrmumm.workers.dev/",
    tvUrl: "https://night-flight.jonathanrmumm.workers.dev/tv",
    palette: { ground: "#211a3d", ink: "#fff4d8", accent: "#ffc94a", accent2: "#7b6ad6" },
    art: { tv: "/art/night-flight/tv.jpg", alt: "/art/night-flight/alt.jpg", extra: { owl: "/art/night-flight/owl.jpg" } },
    look: "Moonlit forest with a giant spiral tree, round felt owls, six colour+symbol stones, dawn creeping in.",
  },
  {
    id: "hearthisle",
    name: "Hearthisle",
    tagline: "Build an island across three homes",
    shape: "live",
    tier: 2,
    minutes: [60, 120],
    ages: "7+ (kids team up with a grown-up)",
    players: "2–4 seats, a seat is a person or a household",
    roles: [
      { id: "seat", audience: "grownup", label: "Seat" },
      { id: "partner", audience: "kid", label: "Seat partner" },
    ],
    startUrl: "https://hearthisle.opengame.org/",
    tvUrl: "https://hearthisle.opengame.org/tv",
    palette: { ground: "#1f6f8b", ink: "#2b2118", accent: "#d9b44a", accent2: "#c8412f" },
    art: { tv: "/art/hearthisle/tv.jpg", alt: "/art/hearthisle/wheat.jpg", extra: { night: "/art/hearthisle/night.jpg", dusk: "/art/hearthisle/dusk.jpg" } },
    look: "Tilt-shift miniature island of painted resin, warm studio key, parchment + carved wood UI, serif display.",
  },
  {
    id: "word-duel",
    name: "Word Duel",
    tagline: "A word game you play over days",
    shape: "async",
    tier: 2,
    minutes: [1, 3],
    ages: "Grown-ups",
    players: "2, anywhere",
    roles: [{ id: "player", audience: "grownup", label: "Player" }],
    startUrl: "https://word-duel.example/",
    palette: { ground: "#f4efe4", ink: "#1d1b16", accent: "#2f6fc8", accent2: "#e08a1e" },
    art: { tv: "" },
    look: "Design-only stand-in (no repo). Letter tiles on a 11×11 board; a list of open games, one per opponent.",
  },
];

export const gameById = (id: string): GameManifest => {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown game ${id}`);
  return g;
};
