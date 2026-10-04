import type { Manifest } from "@open-game-system/ogs-protocol";

const dash = (s: string) => s.replace("-", "–");

/** The game page's facts ("2–4 players", "10–20 min", "Ages 3+"), from the manifest's shop block. */
export function gameFacts(shop: Manifest["shop"]): string[] {
  const facts: string[] = [];
  if (shop.players)
    facts.push(`${dash(shop.players)} ${shop.players === "1" ? "player" : "players"}`);
  if (shop.minutes) {
    const [lo, hi] = shop.minutes;
    facts.push(lo === hi ? `${lo} min` : `${lo}–${hi} min`);
  }
  if (shop.ages) facts.push(`Ages ${shop.ages}`);
  return facts;
}
