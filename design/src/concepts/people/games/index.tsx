// The game's own pages, stood in. In the real app these are the manifest's startUrl in a web view:
// OGS only frames them, so nothing here is OGS code that changes per game.
import type { ReactNode } from "react";
import { RocketPhone } from "./RocketPhone";
import { BakePhone } from "./BakePhone";
import { RocketKid } from "./RocketKid";
import { BakeKid } from "./BakeKid";

export interface KidView {
  frosting?: string;
  pokes: number;
  little: boolean;
  onPoke: () => void;
  onFrost: (c: string) => void;
}

export const PHONE_VIEW: Record<string, (p: { dimmed?: boolean }) => ReactNode> = {
  "rocket-crew": (p) => <RocketPhone {...p} />,
  "bake-shop": (p) => <BakePhone {...p} />,
};

export const KID_VIEW: Record<string, (p: KidView) => ReactNode> = {
  "rocket-crew": (p) => <RocketKid onTap={p.onPoke} pokes={p.pokes} />,
  "bake-shop": (p) => <BakeKid frosting={p.frosting} onFrost={p.onFrost} little={p.little} />,
};
