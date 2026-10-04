import { useEffect, useState } from "react";
import type { IconModel } from "../launcher/home";
import { safeStyle } from "./art";

const REEL_ROUNDS = 3;
const SPIN_MS = 1600;
const HOLD_MS = 900;
/** Icon pitch on the reel (styles.css: .reel-icon width + gap). */
const PITCH = 220 + 36;
/** Where the picked icon lands: the left third, clear of the art's subject. */
const LAND_X = 130;

type Phase = "ready" | "spin" | "landed";

/**
 * Surprise me, selected: the game is already starting on the phone; meanwhile the icons spin past
 * like a reel and land on it, its art fills the room, then the reel gives way to Getting ready.
 * No reading needed.
 */
export function Surprise(props: { icons: IconModel[]; pick: string; onDone: () => void }) {
  const { pick, onDone } = props;
  const [phase, setPhase] = useState<Phase>("ready");
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spin = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase(reduced ? "landed" : "spin")),
    );
    const land = setTimeout(() => setPhase("landed"), reduced ? 0 : SPIN_MS);
    const go = setTimeout(onDone, reduced ? 300 : SPIN_MS + HOLD_MS);
    return () => {
      cancelAnimationFrame(spin);
      clearTimeout(land);
      clearTimeout(go);
    };
  }, [onDone]);
  const target = Math.max(
    0,
    props.icons.findIndex((i) => i.appId === pick),
  );
  const game = props.icons[target];
  const reel = Array.from({ length: REEL_ROUNDS + 1 }, (_, round) =>
    props.icons.map((icon) => ({ icon, key: `${round}-${icon.appId}` })),
  ).flat();
  const stop = phase === "ready" ? 0 : REEL_ROUNDS * props.icons.length + target;
  const landed = phase === "landed";
  return (
    <div
      className="screen surprise-page"
      data-testid="surprise"
      data-pick={pick}
      data-phase={phase}
    >
      {game && (
        <img
          className={`surprise-room${landed ? " in" : ""}`}
          src={game.room.src}
          alt=""
          style={safeStyle(game.room.safe)}
        />
      )}
      <div className="surprise-scrim" />
      <div className="reel" style={{ transform: `translateX(${LAND_X - stop * PITCH}px)` }}>
        {reel.map(({ icon, key }, n) => (
          <div
            key={key}
            className={`reel-icon${n === stop && landed ? " picked" : ""}`}
            data-cover={n === stop && landed ? icon.appId : undefined}
          >
            <img src={icon.icon.src} alt="" style={safeStyle(icon.icon.safe)} />
          </div>
        ))}
      </div>
      {game && landed && (
        <div className="surprise-title">
          {game.logo ? (
            <img className="surprise-logo" src={game.logo} alt={game.name} />
          ) : (
            <p className="spot-wordmark">{game.name}</p>
          )}
        </div>
      )}
    </div>
  );
}
