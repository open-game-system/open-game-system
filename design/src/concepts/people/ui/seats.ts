// Seats come from the manifest's roles and each person's age band: no per-game code, no role picks.
import { COUCH, gameById, type Person } from "../../../world";

export function seatFor(gameId: string, p: Person): string {
  const roles = gameById(gameId).roles;
  const want = p.band;
  const exact = roles.find((r) => r.audience === want);
  const fallback = want === "little" ? roles.find((r) => r.audience === "kid") : undefined;
  return (exact ?? fallback ?? roles[0])?.label ?? "Player";
}

/** The resume point a couch game saved (the household × game slot). */
export const resumePoint = (gameId: string) => COUCH.find((i) => i.gameId === gameId);

/** A short "where you'll pick up" line for a couch game. */
export function pickUp(gameId: string): string {
  const i = resumePoint(gameId);
  if (!i) return "Start fresh";
  return i.title;
}
