// The game's own pages, keyed by the manifest's startUrl in real life. Here: stand-ins per game,
// looked up by id only because the games are fake; OGS chrome never branches on a game.
import type { ComponentType } from "react";
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { RocketCaptain, RocketFixer } from "./Rocket";
import { BakeKid, BakeReader } from "./Bake";

type Grown = ComponentType<{ store: Store<S> }>;
type Kid = ComponentType<{ store: Store<S>; little: boolean; juice: number }>;

const GROWN: Record<string, Grown> = { "rocket-crew": RocketCaptain, "bake-shop": BakeReader };
const KID: Record<string, Kid> = { "rocket-crew": RocketFixer, "bake-shop": BakeKid };

export function GrownupController({ gameId, store }: { gameId: string; store: Store<S> }) {
  const C = GROWN[gameId];
  return C ? <C store={store} /> : null;
}

export function KidController({ gameId, store, little, juice }: { gameId: string; store: Store<S>; little: boolean; juice: number }) {
  const C = KID[gameId];
  return C ? <C store={store} little={little} juice={juice} /> : null;
}
