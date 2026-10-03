// The games' own pages, as Porchlight would load them: a URL per role from the manifest. Here,
// stand-ins keyed by game id; anything without one falls back to its art. Porchlight's chrome
// never changes per game.
import type { ComponentType } from "react";
import type { Person } from "../../../world";
import { gameById } from "../../../world";
import { BakeBaker } from "./BakeBaker";
import { BakeHelper } from "./BakeHelper";
import { BakeReader } from "./BakeReader";
import { RocketCaptain } from "./RocketCaptain";
import { RocketFixer } from "./RocketFixer";
import { KidBadge } from "../ipad/KidBadge";

type KidPage = ComponentType<{ kid: Person }>;
const PAGES: Record<string, { phone: ComponentType; kid: KidPage; little?: KidPage }> = {
  "rocket-crew": { phone: RocketCaptain, kid: RocketFixer },
  "bake-shop": { phone: BakeReader, kid: BakeBaker, little: BakeHelper },
};

export const phoneController = (gameId: string): ComponentType => PAGES[gameId]?.phone ?? (() => <ArtPage gameId={gameId} />);

export function kidController(gameId: string, kid: Person): KidPage {
  const p = PAGES[gameId];
  if (!p) return ({ kid: k }) => <ArtPage gameId={gameId} kid={k} />;
  return kid.band === "little" ? p.little ?? p.kid : p.kid;
}

function ArtPage({ gameId, kid }: { gameId: string; kid?: Person }) {
  const g = gameById(gameId);
  return (
    <div className="g-art" style={{ background: `${g.palette.ground} url(${g.art.tv}) center / cover` }}>
      {kid && <KidBadge kid={kid} />}
    </div>
  );
}
