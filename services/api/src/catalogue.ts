import { type Manifest, ManifestSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * The OGS catalogue: the five deployed family games. All are room-based, so none has a static
 * `tvUrl`; the phone page sends the room's TV URL at runtime (`game.view`).
 */
const RoomGameManifestSchema = ManifestSchema;

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
    art: {
      icon: "/art/rocket-crew/icon.png",
      cover: "/art/rocket-crew/cover.jpg",
      logo: "/art/rocket-crew/logo.png",
      heroClean: "/art/rocket-crew/hero-clean.jpg",
      tile: "/art/rocket-crew/tv.jpg",
      hero: "/art/rocket-crew/tv.jpg",
      safe: { scale: 1.17, ox: 50, oy: 100 },
    },
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
    art: {
      icon: "/art/bake-shop/icon.png",
      cover: "/art/bake-shop/cover.jpg",
      logo: "/art/bake-shop/logo.png",
      heroClean: "/art/bake-shop/hero-clean.jpg",
      tile: "/art/bake-shop/tv.jpg",
      hero: "/art/bake-shop/alt.jpg",
      safe: { scale: 1.15, ox: 28, oy: 100 },
    },
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
    art: {
      icon: "/art/story-nook/icon.png",
      cover: "/art/story-nook/cover.jpg",
      logo: "/art/story-nook/logo.png",
      heroClean: "/art/story-nook/hero-clean.jpg",
      tile: "/art/story-nook/tv.jpg",
      hero: "/art/story-nook/journey.jpg",
      safe: { scale: 1.04, ox: 50, oy: 60 },
    },
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
    art: {
      icon: "/art/peekaboo-garden/icon.png",
      cover: "/art/peekaboo-garden/cover.jpg",
      logo: "/art/peekaboo-garden/logo.png",
      heroClean: "/art/peekaboo-garden/hero-clean.jpg",
      tile: "/art/peekaboo-garden/tv.jpg",
      hero: "/art/peekaboo-garden/tv.jpg",
      safe: { scale: 1.13, ox: 50, oy: 100 },
    },
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
    art: {
      icon: "/art/night-flight/icon.png",
      cover: "/art/night-flight/cover.jpg",
      logo: "/art/night-flight/logo.png",
      heroClean: "/art/night-flight/hero-clean.jpg",
      tile: "/art/night-flight/tv.jpg",
      hero: "/art/night-flight/tv.jpg",
      safe: { scale: 1.85, ox: 46, oy: 49 },
    },
    shop: { ages: "3+", minutes: [10, 20], players: "2-4" },
  },
];

export const CATALOGUE: readonly Manifest[] = SEED.map((m) => RoomGameManifestSchema.parse(m));

export const catalogueIds = (): string[] => CATALOGUE.map((m) => m.appId);

export const findManifest = (appId: string): Manifest | undefined =>
  CATALOGUE.find((m) => m.appId === appId);

const StartUrlsSchema = z.record(z.string(), z.string().url());

/**
 * The catalogue with local start URLs (`CATALOGUE_START_URLS` = JSON `{ appId: url }`), so a dev
 * stack or an e2e run can open a game served on localhost. Never adds games; a malformed value is
 * ignored. Production leaves it unset.
 */
export function catalogueFor(env: { CATALOGUE_START_URLS?: string }): readonly Manifest[] {
  if (!env.CATALOGUE_START_URLS) return CATALOGUE;
  let raw: unknown;
  try {
    raw = JSON.parse(env.CATALOGUE_START_URLS);
  } catch {
    return CATALOGUE;
  }
  const parsed = StartUrlsSchema.safeParse(raw);
  if (!parsed.success) return CATALOGUE;
  const urls = parsed.data;
  return CATALOGUE.map((m) => (urls[m.appId] ? { ...m, startUrl: urls[m.appId] } : m));
}
