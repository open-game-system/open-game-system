// The big friendly remote: for when your eyes are on the TV, not the phone. One thumb: a ring you
// can feel (four arrows around a big OK), Back and Home under it.
import { back, home, move, ok } from "../actions";
import type { S } from "../state";

type Act = (fn: (s: S) => S) => void;

function Arrow({ dir, act }: { dir: "up" | "down" | "left" | "right"; act: Act }) {
  return (
    <button type="button" className={`cr-pad-arrow cr-pad-${dir}`} aria-label={dir} data-bot={dir} onClick={() => act((s) => move(s, dir))}>
      <span className="cr-chev" />
    </button>
  );
}

export function Remote({ act, big }: { act: Act; big: boolean }) {
  return (
    <div className={`cr-remote ${big ? "is-big" : ""}`}>
      <div className="cr-pad">
        <Arrow dir="up" act={act} />
        <Arrow dir="left" act={act} />
        <Arrow dir="right" act={act} />
        <Arrow dir="down" act={act} />
        <button type="button" className="cr-pad-ok" data-bot="ok" onClick={() => act(ok)}>
          OK
        </button>
      </div>
      <div className="cr-remote-row">
        <button type="button" className="cr-rbtn" data-bot="back" onClick={() => act(back)}>
          <span className="cr-glyph-back" />
          Back
        </button>
        <button type="button" className="cr-rbtn" data-bot="home" onClick={() => act(home)}>
          <span className="cr-glyph-home" />
          Home
        </button>
      </div>
    </div>
  );
}
