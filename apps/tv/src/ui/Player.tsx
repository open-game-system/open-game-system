import type { Manifest, Screen } from "@open-game-system/ogs-protocol";
import { useLayoutEffect, useRef } from "react";
import { boxFrame } from "../launcher/cutover";
import type { FrameSlot } from "../launcher/frames";
import { roomArt } from "../launcher/home";
import { noViewCopy, playerCard } from "../launcher/starting";
import { safeStyle } from "./art";
import type { useFrames } from "./useFrames";

const W = 1920;
const H = 1080;
/** Slow out of the box, quick through the middle, settling into full screen: one weighted motion. */
const EASE = "cubic-bezier(0.5, 0, 0.15, 1)";
const DURATION = 680;

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

/** The box the game grows out of: the item it was started from, else its icon. */
function coverOf(player: HTMLElement, appId: string, origin: string | null) {
  const selectors = [
    `[data-cover-page="${appId}"]`,
    origin ? `[data-item="${origin}"] [data-cover-card]` : null,
    `[data-cover="${appId}"]`,
  ];
  for (const sel of selectors) {
    const rect = sel ? rectInStage(player, sel) : null;
    const img = sel
      ? player.closest(".stage")?.querySelector<HTMLImageElement>(`${sel} img`)
      : null;
    if (rect) return { rect, src: img?.currentSrc || null };
  }
  return null;
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
  tile: React.RefObject<HTMLImageElement | null>,
  shown: boolean,
  appId: string | null,
  origin: string | null,
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
    const found = appId ? coverOf(el, appId, origin) : null;
    const cover = found?.rect ?? null;
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
    // The box's own picture rides the motion: it hands over to the room as the box opens, and
    // comes back as it closes, so the icon (or card) and the game read as one object.
    const img = tile.current;
    if (!img || !found?.src) return;
    for (const a of img.getAnimations()) a.cancel();
    img.src = found.src;
    const k = Math.max(cover.w / W, cover.h / H);
    Object.assign(img.style, {
      left: `${(W - cover.w / k) / 2}px`,
      top: `${(H - cover.h / k) / 2}px`,
      width: `${cover.w / k}px`,
      height: `${cover.h / k}px`,
    });
    const fade = shown
      ? [{ opacity: 1 }, { opacity: 1, offset: 0.08 }, { opacity: 0, offset: 0.35 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 0.8 }, { opacity: 1 }];
    img.animate(fade, { duration: DURATION, easing: "linear", fill: "forwards" });
  }, [shown, appId, origin, ref, tile]);
}

export function Player(props: {
  screen: Screen;
  game: Manifest | null;
  hostPhone: string;
  remoteHolder: string | null;
  frames: ReturnType<typeof useFrames>;
  /** The game never sent its TV page in time (useViewTimeout). */
  viewOverdue: boolean;
  /** The home item the game was started from (a card grows out of its card, not its icon). */
  origin: string | null;
}) {
  const { game, frames } = props;
  const ref = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLImageElement>(null);
  const shown = props.screen === "game";
  const art = game ? roomArt(game) : null;
  useCutOver(ref, tile, shown, game?.appId ?? null, props.origin);
  const { active, parked } = frames.frames;
  const slots = [active, parked].filter((s): s is FrameSlot => s !== null);
  const activeShowing = active !== null && frames.isLoaded(active);
  const waiting = shown && !activeShowing;
  const card = playerCard({
    shown,
    game: game !== null,
    active: active !== null,
    frameFailed: frames.activeFailed,
    viewOverdue: props.viewOverdue,
  });
  const noView = game && card === "no-view" ? noViewCopy(game.name, props.remoteHolder) : null;
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
      <img ref={tile} className="player-tile" alt="" />
      {game && card === "starting" && (
        <div className="player-card" data-testid="starting">
          {game.art.logo && <img className="player-logo" src={game.art.logo} alt="" />}
          <p className="eyebrow">
            <span className="pulse" />
            Getting ready
          </p>
          <p className="player-line">
            Starting {game.name} on {props.hostPhone}
          </p>
        </div>
      )}
      {game && noView && (
        <div className="player-card" data-testid="no-view">
          {game.art.logo && <img className="player-logo" src={game.art.logo} alt="" />}
          <p className="eyebrow">{noView.eyebrow}</p>
          <p className="player-line">{noView.line}</p>
          <p className="player-sub">{noView.sub}</p>
        </div>
      )}
      {game && card === "frame-failed" && (
        <div className="player-card" data-testid="frame-failed">
          {game.art.logo && <img className="player-logo" src={game.art.logo} alt="" />}
          <p className="eyebrow">Couldn't open</p>
          <p className="player-line">{game.name} didn't open on the TV</p>
          <p className="player-sub">
            Choose another on {props.remoteHolder ? `${props.remoteHolder}'s phone` : "your phone"}
          </p>
        </div>
      )}
    </div>
  );
}
