// The child's own character (the one Story Nook painted), standing on a glowing pad in their
// colour. It is the one constant on every kid screen: it lives at the bottom centre, between the
// thumbs, and hops when poked. Poking it never does anything but delight.
import { useState, type PointerEvent } from "react";
import type { Person } from "../../../world";

/**
 * Equal presence for every child's character: art that covers less of its frame (the dinosaur's
 * long neck and tail leave half of it empty; the dragon's wings fill two thirds) is drawn larger,
 * by the square root of the coverage ratio, so Ava's dinosaur stands as big as Juneau's dragon.
 */
const PRESENCE: Record<string, number> = { "/art/story-nook/char-dinosaur.webp": 1.14 };

export function KidChar({
  who,
  size,
  className = "",
  sleeping = false,
  cheer = 0,
  onPoke,
}: {
  who: Person;
  size: number;
  className?: string;
  sleeping?: boolean;
  /** Bump to make the character cheer (hop) from outside, e.g. when a press lands. */
  cheer?: number;
  onPoke?: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  const [hop, setHop] = useState(0);
  const src = sleeping && who.id === "ava" ? "/art/story-nook/char-dinosaur-sleep.webp" : who.portrait;
  return (
    <button
      className={`kd-char ${sleeping ? "kd-char--sleep" : ""} ${className}`}
      style={{ width: size, height: size, color: who.color }}
      aria-label={who.name}
      data-bot={`kid-char-${who.id}`}
      onPointerDown={(e) => {
        setHop((h) => h + 1);
        onPoke?.(e);
      }}
    >
      <span className="kd-char__pad" aria-hidden />
      {src && <img key={`${hop}-${cheer}`} style={{ "--w": `${88 * (PRESENCE[src] ?? 1)}%`, "--h": `${92 * (PRESENCE[src] ?? 1)}%` }} className={`kd-char__art ${hop + cheer ? (sleeping ? "is-stir" : "is-hop") : ""}`} src={src} alt="" draggable={false} />}
    </button>
  );
}
