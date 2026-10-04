import type { Manifest, Screen } from "@open-game-system/ogs-protocol";
import { useLayoutEffect, useRef } from "react";
import { boxFrame } from "../launcher/cutover";
import type { FrameSlot } from "../launcher/frames";
import { roomArt } from "../launcher/home";
import { safeStyle } from "./art";
import type { useFrames } from "./useFrames";

const W = 1920;
const H = 1080;
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";
const DURATION = 620;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A box's rect in stage px (the stage is scaled to the receiver). */
function rectInStage(player: HTMLElement, selector: string): Rect | null {
  const stage = player.closest(".stage");
  const el = stage?.querySelector(selector);
  if (!stage || !el) return null;
  const s = stage.getBoundingClientRect();
  const k = s.width / W;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

/** A rect that already fills the stage (the game page's art): nothing to grow from. */
const fillsStage = (r: Rect) => r.w >= W - 1 && r.h >= H - 1;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The cut-over: starting a game, the focused box grows from its rect to full screen and the frame
 * fades in; on Home, the frame shrinks back into its box. The page itself never reloads.
 */
function useCutOver(
  ref: React.RefObject<HTMLDivElement | null>,
  shown: boolean,
  appId: string | null,
) {
  const was = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown === was.current) return;
    was.current = shown;
    for (const a of el.getAnimations()) a.cancel();
    // Phase first: while the player is up, the shelves jump instead of sliding (styles.css), so
    // the box measured below is where it will rest, not where a scroll transition starts.
    el.dataset.phase = shown ? "entering" : "leaving";
    const cover = appId
      ? (rectInStage(el, `[data-cover-page="${appId}"]`) ??
        rectInStage(el, `[data-cover="${appId}"]`))
      : null;
    const done = () => {
      el.dataset.phase = shown ? "shown" : "hidden";
    };
    if (reducedMotion() || !cover || fillsStage(cover)) {
      const fade = [{ opacity: shown ? 0 : 1 }, { opacity: shown ? 1 : 0 }];
      el.animate(fade, { duration: reducedMotion() ? 180 : 320, easing: "ease-out" }).onfinish =
        done;
      return;
    }
    const small = boxFrame(cover);
    const big = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(0px 0px round 0px)" };
    const frames = shown
      ? [
          { ...small, opacity: 1 },
          { ...big, opacity: 1 },
        ]
      : [
          { ...big, opacity: 1 },
          { ...small, opacity: 1, offset: 0.82 },
          { ...small, opacity: 0 },
        ];
    el.animate(frames, { duration: DURATION, easing: EASE }).onfinish = done;
  }, [shown, appId, ref]);
}

export function Player(props: {
  screen: Screen;
  game: Manifest | null;
  hostPhone: string;
  remoteHolder: string | null;
  frames: ReturnType<typeof useFrames>;
}) {
  const { game, frames } = props;
  const ref = useRef<HTMLDivElement>(null);
  const shown = props.screen === "game";
  const art = game ? roomArt(game) : null;
  useCutOver(ref, shown, game?.appId ?? null);
  const { active, parked } = frames.frames;
  const slots = [active, parked].filter((s): s is FrameSlot => s !== null);
  const activeShowing = active !== null && frames.isLoaded(active);
  const waiting = shown && !activeShowing;
  return (
    <div
      ref={ref}
      className={`player${waiting ? " waiting" : ""}`}
      data-phase="hidden"
      data-testid="player"
    >
      {art && <img className="player-art" src={art.src} alt="" style={safeStyle(art.safe)} />}
      {slots.map((slot) => (
        <iframe
          key={slot.instanceId}
          ref={(el) => frames.register(slot.instanceId, el)}
          className={`game-frame${slot === active && activeShowing ? " live" : ""}`}
          data-testid={slot === active ? "game-frame" : "parked-frame"}
          data-app={slot.appId}
          title={slot.appId}
          src={slot.url}
          allow="autoplay; fullscreen"
          onLoad={() => frames.onLoad(slot)}
        />
      ))}
      {shown && game && !active && (
        <div className="player-card" data-testid="starting">
          <p className="eyebrow">Getting ready</p>
          <p className="player-line">
            Starting {game.name} on {props.hostPhone}
          </p>
        </div>
      )}
      {shown && game && active && frames.activeFailed && (
        <div className="player-card" data-testid="frame-failed">
          <p className="eyebrow">{game.name}</p>
          <p className="player-line">{game.name} didn't open on the TV</p>
          <p className="player-sub">
            Choose another on {props.remoteHolder ? `${props.remoteHolder}'s phone` : "your phone"}
          </p>
        </div>
      )}
    </div>
  );
}
