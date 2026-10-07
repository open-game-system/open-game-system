import { useEffect, useState } from "react";
import { createThemePlayer, type ThemePlayer } from "./theme-player";

/** Theme audio elements live in one hidden box, so a test can see what is playing. */
function domPlayer(): { player: ThemePlayer; box: HTMLElement } {
  const box = document.createElement("div");
  box.dataset.testid = "theme-audio";
  box.hidden = true;
  document.body.append(box);
  const player = createThemePlayer({
    create: (src) => {
      const el = document.createElement("audio");
      el.src = src;
      el.preload = "auto";
      box.append(el);
      return el;
    },
    release: (track) => {
      if (track instanceof HTMLAudioElement) {
        track.removeAttribute("src");
        track.load();
        track.remove();
      }
    },
  });
  return { player, box };
}

/**
 * Plays `src` (the focused game's theme, from themeFor) and crossfades as it changes; null is
 * silence. A theme the browser refused to autoplay starts on the next key press or tap.
 */
export function useTheme(src: string | null): void {
  const [player, setPlayer] = useState<ThemePlayer | null>(null);
  useEffect(() => {
    const { player: p, box } = domPlayer();
    setPlayer(p);
    const retry = () => p.retry();
    window.addEventListener("keydown", retry);
    window.addEventListener("pointerdown", retry);
    return () => {
      window.removeEventListener("keydown", retry);
      window.removeEventListener("pointerdown", retry);
      p.dispose();
      box.remove();
    };
  }, []);
  useEffect(() => {
    player?.set(src);
  }, [player, src]);
}
