import type { ClientMessage } from "@open-game-system/ogs-protocol";
import { useEffect, useState } from "react";
import type { IconModel } from "../launcher/home";
import { pickSurprise } from "../launcher/shortcuts";
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
 * Surprise me, opened: the icons spin past like a reel and land on one game, its art fills the
 * room, and it starts. No reading needed. `start` builds the game.start for the picked game.
 */
export function Surprise(props: {
  icons: IconModel[];
  recent: string | null;
  start: (appId: string) => ClientMessage | null;
  send: (msg: ClientMessage) => void;
}) {
  const [pick] = useState(() => pickSurprise(props.icons, props.recent, Math.random));
  const [phase, setPhase] = useState<Phase>("ready");
  const { start, send } = props;
  useEffect(() => {
    if (!pick) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spin = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase(reduced ? "landed" : "spin")),
    );
    const land = setTimeout(() => setPhase("landed"), reduced ? 0 : SPIN_MS);
    const go = setTimeout(
      () => {
        const msg = start(pick);
        if (msg) send(msg);
      },
      reduced ? 300 : SPIN_MS + HOLD_MS,
    );
    return () => {
      cancelAnimationFrame(spin);
      clearTimeout(land);
      clearTimeout(go);
    };
  }, [pick, start, send]);
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
      data-pick={pick ?? ""}
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
