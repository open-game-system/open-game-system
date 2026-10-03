import type { Scenario } from "../../harness/types";
import { devState } from "./dev/pages";
import type { S } from "./state";

/** Scenarios owned by the developer-page owner (flow "add-game"; device "desktop"). One scenario = one 1440×900 page. */
export const devScenarios: Scenario<S>[] = [
  { id: "add-game.01-docs-overview", label: "Docs: bring your game to OGS (the tier ladder)", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("overview") },
  { id: "add-game.02-docs-manifest", label: "Docs: Tier 0, a manifest for Peekaboo Garden", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("manifest") },
  { id: "add-game.03-docs-identity", label: "Docs: Tier 1, identity token + saves", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("identity") },
  { id: "add-game.04-docs-instances", label: "Docs: Tier 2, the instance POST (Rocket Crew paused for Bake Shop)", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("instances") },
  { id: "add-game.05-docs-tv", label: "Docs: the TV page contract", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("casting") },
  { id: "add-game.06-docs-kids", label: "Docs: kid devices (roles with audience, no words)", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("kids") },
  { id: "add-game.07-tiers-in-library", label: "Bake Shop at Tier 0 / 1 / 2 on the family's Home, Library, iPads and lock screen", flow: "add-game", state: "default", devices: ["desktop"], build: () => devState("library") },
  { id: "add-game.08-console-empty", label: "Console: no games yet (paste a manifest or read it from your domain)", flow: "add-game", state: "empty", devices: ["desktop"], build: () => devState("console-empty") },
  { id: "add-game.09-console-invalid", label: "Console: live validation — TV URL not https, a role without an audience", flow: "add-game", state: "error", devices: ["desktop"], build: () => devState("console-error") },
  { id: "add-game.10-console-preview", label: "Console: valid — library tile, TV cast, seats; testing on the living room TV", flow: "add-game", state: "partial", devices: ["desktop"], build: () => devState("console-preview") },
  { id: "add-game.11-console-live", label: "Console: published — every game's tier signals (token verified, last POST 2 min ago)", flow: "add-game", state: "success", devices: ["desktop"], build: () => devState("console-live") },
];
