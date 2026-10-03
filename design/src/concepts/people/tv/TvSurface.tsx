// The TV: a cast nobody touches. The game owns it full-bleed; OGS appears only between games
// and in a corner capsule that never reaches the focal area.
import type { ReactNode } from "react";
import { gameById, person } from "../../../world";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { Patch } from "../ui/Patch";
import { TvAmbient } from "./TvAmbient";
import { TvCutover } from "./TvCutover";
import { TvArrivals } from "./TvArrivals";

function FullBleed({ src, dim }: { src: string; dim?: boolean }) {
  return <img className={`pf-tv-art${dim ? " dim" : ""}`} src={src} alt="" />;
}

/** A small capsule in the lower-left corner: the only OGS chrome allowed over a running game. */
export function Capsule({ children }: { children: ReactNode }) {
  return <div className="pf-tv-capsule">{children}</div>;
}

export function TvSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  const c = s.couch;
  if (!c.gameId) return <div className="pf pf-tv"><TvAmbient /></div>;
  const game = gameById(c.gameId);
  const left = c.left ? gameById(c.left.gameId) : undefined;
  return (
    <div className="pf pf-tv">
      {c.phase === "saving" && left ? (
        <>
          <FullBleed src={left.art.tv} dim />
          <Capsule>
            <span className="pf-tv-spinner" /> Saving {c.left?.savedAt}
          </Capsule>
        </>
      ) : c.phase === "cutover" && left ? (
        <TvCutover from={left} to={game} savedAt={c.left?.savedAt ?? ""} />
      ) : c.phase === "following" ? (
        <TvArrivals game={game} arrived={c.arrived} avaAsleep={c.avaAsleep} />
      ) : (
        <>
          <FullBleed src={game.art.tv} key={game.id} />
          {c.avaAsleep && (
            <Capsule>
              <Patch person={person("ava")} size={52} dim /> Ava's seat is saved
            </Capsule>
          )}
        </>
      )}
    </div>
  );
}
