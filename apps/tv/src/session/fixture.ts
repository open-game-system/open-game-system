import type { Instance, Manifest } from "@open-game-system/ogs-protocol";
import type { Household } from "./data";

/** The household and games fake mode runs on (tests and design). */
const game = (
  appId: string,
  name: string,
  tagline: string,
  tv: Manifest["tv"],
  shape: Manifest["shape"] = "couch",
): Manifest => ({
  appId,
  name,
  tagline,
  shape,
  tv,
  startUrl: `https://${appId}.jonathanrmumm.workers.dev/`,
  tvUrl: tv === "none" ? undefined : `https://${appId}.jonathanrmumm.workers.dev/tv`,
  roles: [],
  art: { tile: `/art/${appId}/tv.jpg`, hero: `/art/${appId}/alt.jpg` },
  shop: {},
  instanceTtlMs: 7 * 24 * 60 * 60 * 1000,
});

export const FIXTURE_GAMES: Manifest[] = [
  game("rocket-crew", "Rocket Crew", "Fly the rocket together", "required"),
  game("bake-shop", "Bake Shop", "Bake what the bears order", "required"),
  game("story-nook", "Story Nook", "Paint a character, tell a story", "required"),
  game("peekaboo-garden", "Peekaboo Garden", "Find who is hiding", "required"),
  game("night-flight", "Night Flight", "Fly the owls home before sunrise", "required"),
  {
    ...game("hearthisle", "Hearthisle", "Settle the island", "optional", "live"),
    art: { tile: "/art/hearthisle/tv.jpg", hero: "/art/hearthisle/dusk.jpg" },
  },
];

export const FIXTURE_HOUSEHOLD: Household = {
  id: "mumms",
  name: "The Mumms",
  people: [
    { id: "jonathan", name: "Jonathan", sticker: "bear" },
    { id: "mom", name: "Mom", sticker: "owl" },
    { id: "juneau", name: "Juneau", sticker: "dragon" },
    { id: "ava", name: "Ava", sticker: "dinosaur" },
  ],
};

export function fixtureInstances(now: number): Instance[] {
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const startsAt = tonight.getTime() > now ? tonight.getTime() : now + 60 * 60 * 1000;
  return [
    {
      instanceId: "hearthisle-night",
      appId: "hearthisle",
      householdId: "mumms",
      status: "lobby",
      title: "Game night",
      detail: "Turn 14 · the Okafors are in",
      startsAt,
      updatedAt: now - 60 * 60 * 1000,
      source: "server",
    },
    {
      instanceId: "story-nook-ember",
      appId: "story-nook",
      householdId: "mumms",
      status: "suspended",
      title: "Juneau's dragon is ready",
      detail: "",
      updatedAt: now - 26 * 60 * 60 * 1000,
      source: "bridge",
    },
  ];
}
