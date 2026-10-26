import { onOgsPause } from "@open-game-system/profile-kit";
import type { Color } from "../game/rules";
import { createAudioPause } from "./audio-pause";

/**
 * A tiny synthesized instrument (no audio files): a pentatonic note per color, a reveal chord and a
 * soft buzz. Parked by the OGS launcher (Home, another game) means silent: onOgsPause.
 */
const NOTE: Record<Color, number> = { coral: 523.25, sky: 587.33, lime: 659.25, gold: 783.99 };

let ctx: AudioContext | null = null;
const gate = createAudioPause(() => ctx);
onOgsPause((paused) => gate.setPaused(paused));

/** iPhones mute Web Audio on silent unless the session is "playback". Call from a tap, or on a TV. */
export function unlockAudio(): void {
  const session = Reflect.get(navigator, "audioSession");
  if (session && typeof session === "object") Reflect.set(session, "type", "playback");
  ctx ??= new AudioContext();
  if (gate.unlocked(ctx) && ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, at: number, length: number, type: OscillatorType = "triangle", gain = 0.18) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export const sfx = {
  pick: (c: Color) => tone(NOTE[c], 0, 0.25),
  kite: (c: Color) => tone(NOTE[c] * 2, 0, 0.12, "sine", 0.06),
  reveal: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.6)),
  buzz: () => tone(130.81, 0, 0.35, "square", 0.05),
  start: () => [392, 523.25].forEach((f, i) => tone(f, i * 0.12, 0.3)),
};
