import { type Manifest, ManifestSchema } from "@open-game-system/ogs-protocol";

/**
 * The OGS catalogue: the five deployed family games. All are room-based, so none has a static
 * `tvUrl`; the phone page sends the room's TV URL at runtime (`game.view`).
 *
 * ManifestSchema's refine demands a tvUrl whenever tv is "optional"/"required", which contradicts
 * its own doc ("Room-based games omit it"). Until the protocol relaxes that refine, the catalogue
 * is parsed with the schema's object shape (every field rule, minus that one refine).
 */
const RoomGameManifestSchema = ManifestSchema.innerType();

/** Seed input: defaults (tagline, shop, instanceTtlMs) filled in by the parse. */
type ManifestInput = (typeof RoomGameManifestSchema)["_input"];

const workers = (appId: string) => `https://${appId}.jonathanrmumm.workers.dev/`;

const SEED: ManifestInput[] = [
  {
    appId: "rocket-crew",
    name: "Rocket Crew",
    tagline: "Fly the rocket together: the Captain reads, the Fixer presses.",
    shape: "couch",
    tv: "required",
    startUrl: workers("rocket-crew"),
    roles: [
      { id: "captain", label: "Captain", audience: "grownup" },
      { id: "fixer", label: "Fixer", audience: "kid" },
    ],
    art: { tile: "/art/rocket-crew/tv.jpg", hero: "/art/rocket-crew/launch.jpg" },
    shop: { ages: "4+", minutes: [10, 20], players: "2" },
  },
  {
    appId: "bake-shop",
    name: "Bake Shop",
    tagline: "Animal customers, picture orders, a sprinkle of chaos.",
    shape: "couch",
    tv: "required",
    startUrl: workers("bake-shop"),
    roles: [
      { id: "grownup", label: "Grown-up", audience: "grownup" },
      { id: "baker", label: "Baker", audience: "kid" },
      { id: "sprinkler", label: "Sprinkler", audience: "little" },
    ],
    art: { tile: "/art/bake-shop/tv.jpg", hero: "/art/bake-shop/alt.jpg" },
    shop: { ages: "2+", minutes: [10, 25], players: "2-4" },
  },
  {
    appId: "story-nook",
    name: "Story Nook",
    tagline: "A bedtime pop-up storybook you read together.",
    shape: "couch",
    tv: "required",
    startUrl: workers("story-nook"),
    roles: [
      { id: "grownup", label: "Reader", audience: "grownup" },
      { id: "kid", label: "Kid", audience: "kid" },
      { id: "little", label: "Little one", audience: "little" },
    ],
    art: { tile: "/art/story-nook/tv.jpg", hero: "/art/story-nook/journey.jpg" },
    shop: { ages: "2+", minutes: [10, 20], players: "2-4" },
  },
  {
    appId: "peekaboo-garden",
    name: "Peekaboo Garden",
    tagline: "Hide-and-seek in a garden: clues on the phone, a magnifier on the iPad.",
    shape: "couch",
    tv: "required",
    startUrl: workers("peekaboo-garden"),
    roles: [
      { id: "grownup", label: "Clue keeper", audience: "grownup" },
      { id: "seeker", label: "Seeker", audience: "kid" },
      { id: "little", label: "Little one", audience: "little" },
    ],
    art: { tile: "/art/peekaboo-garden/tv.jpg", hero: "/art/peekaboo-garden/alt.jpg" },
    shop: { ages: "2+", minutes: [10, 20], players: "2-4" },
  },
  {
    appId: "night-flight",
    name: "Night Flight",
    tagline: "Fly through the night sky together.",
    shape: "couch",
    tv: "required",
    startUrl: workers("night-flight"),
    roles: [
      { id: "navigator", label: "Navigator", audience: "grownup" },
      { id: "pilot", label: "Pilot", audience: "kid" },
      { id: "little", label: "Little one", audience: "little" },
    ],
    art: { tile: "/art/night-flight/tv.jpg", hero: "/art/night-flight/alt.jpg" },
    shop: { ages: "3+", minutes: [10, 20], players: "2-4" },
  },
];

export const CATALOGUE: readonly Manifest[] = SEED.map((m) => RoomGameManifestSchema.parse(m));

export const catalogueIds = (): string[] => CATALOGUE.map((m) => m.appId);

export const findManifest = (appId: string): Manifest | undefined =>
  CATALOGUE.find((m) => m.appId === appId);
