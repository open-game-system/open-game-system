// The games' own views, keyed by game id. In the real product each of these is the game's web
// page in a WebView (phone/iPad) or the cast stream (TV); OGS never draws inside them. This map is
// the prototype standing in for "load the game's URL"; the console code around it is game-agnostic.
import type { ReactNode } from "react";
import { gameById, type Person, type Role } from "../../../world";
import { RocketCaptain, RocketFixer } from "./Rocket";
import { BakeBaker, BakeHelper, BakeReader } from "./Bake";
import { person } from "../../../world";

export function GamePhoneView({ gameId }: { gameId: string }): ReactNode {
  if (gameId === "rocket-crew") return <RocketCaptain juneau={person("juneau")} />;
  if (gameId === "bake-shop") return <BakeReader />;
  const g = gameById(gameId);
  return (
    <div className="g-generic" style={{ background: g.palette.ground, color: g.palette.ink }}>
      <img src={g.art.alt ?? g.art.tv} alt="" />
    </div>
  );
}

export function GameKidView({ gameId, who, role }: { gameId: string; who: Person; role: Role }): ReactNode {
  if (gameId === "rocket-crew") return <RocketFixer who={who} />;
  if (gameId === "bake-shop") return role.audience === "little" ? <BakeHelper who={who} /> : <BakeBaker who={who} />;
  const g = gameById(gameId);
  return (
    <div className="g-generic" style={{ background: g.palette.ground }}>
      <img src={g.art.tv} alt="" />
    </div>
  );
}

/** What the game streams to the TV. The game owns every pixel of it. */
export function GameTvView({ gameId }: { gameId: string }): ReactNode {
  const g = gameById(gameId);
  return <img className="cx-tv-game" src={g.art.tv} alt="" />;
}
