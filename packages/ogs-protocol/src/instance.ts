import { z } from "zod";

export const InstanceStatusSchema = z.enum([
  "lobby",
  "active",
  "suspended",
  "waiting",
  "completed",
  "expired",
]);
export type InstanceStatus = z.infer<typeof InstanceStatusSchema>;

/** One sitting of one game for one household. Reported by the game (bridge or server) or recorded by OGS on visit. */
export const InstanceSchema = z.object({
  instanceId: z.string().min(1),
  appId: z.string().min(1),
  householdId: z.string().min(1),
  status: InstanceStatusSchema,
  title: z.string().default(""),
  detail: z.string().default(""),
  /** For async games: true when it's this household's move. */
  yourTurn: z.boolean().optional(),
  /** For scheduled sittings (a game night): when it starts, ms since epoch. */
  startsAt: z.number().optional(),
  /** Where to send people back in. */
  resumeUrl: z.string().url().optional(),
  updatedAt: z.number(),
  /** bridge / server = the game reported it; visit = OGS only saw it opened (Tier 0). */
  source: z.enum(["bridge", "server", "visit"]),
});
export type Instance = z.infer<typeof InstanceSchema>;

/** What a game reports (the household comes from its token, the time from the receiver). */
export const InstanceReportSchema = InstanceSchema.pick({
  instanceId: true,
  appId: true,
  status: true,
  title: true,
  detail: true,
  yourTurn: true,
  startsAt: true,
  resumeUrl: true,
});
export type InstanceReport = z.infer<typeof InstanceReportSchema>;

export type SectionKind = "yourTurn" | "tonight" | "paused" | "waiting" | "finished";
export interface PlayingSection {
  kind: SectionKind;
  items: Instance[];
}
export interface PlayingView {
  /** The game on a screen right now, pinned on top ("Now playing"). */
  live: Instance | null;
  sections: PlayingSection[];
  /** Your-turn count for the tab badge. */
  badge: number;
}

const DAY = 24 * 60 * 60 * 1000;
const ORDER: SectionKind[] = ["yourTurn", "tonight", "paused", "waiting", "finished"];

function sectionFor(i: Instance, now: number): SectionKind | null {
  switch (i.status) {
    case "expired":
      return null;
    case "completed":
      return now - i.updatedAt <= DAY ? "finished" : null;
    case "waiting":
      return i.yourTurn ? "yourTurn" : "waiting";
    case "lobby":
    case "suspended":
    case "active":
      if (i.startsAt !== undefined && i.startsAt >= now && i.startsAt - now <= DAY)
        return "tonight";
      return "paused";
  }
}

/**
 * The Playing tab: the live game pinned, then everything in flight ordered by what needs you.
 * Silent instances past their game's TTL are hidden; Tier 0 visits collapse to one per game.
 */
export function playingView(
  instances: Instance[],
  opts: { now: number; liveInstanceIds: string[]; ttlFor: (appId: string) => number },
): PlayingView {
  const { now, liveInstanceIds, ttlFor } = opts;
  const fresh = instances.filter(
    (i) => i.status === "completed" || now - i.updatedAt <= ttlFor(i.appId),
  );
  const newestVisit = new Map<string, Instance>();
  for (const i of fresh) {
    if (i.source !== "visit") continue;
    const seen = newestVisit.get(i.appId);
    if (!seen || seen.updatedAt < i.updatedAt) newestVisit.set(i.appId, i);
  }
  const kept = fresh.filter((i) => i.source !== "visit" || newestVisit.get(i.appId) === i);
  const live =
    kept.find((i) => liveInstanceIds.includes(i.instanceId) && i.status !== "completed") ?? null;
  const byKind = new Map<SectionKind, Instance[]>();
  for (const i of kept) {
    if (i === live) continue;
    const kind = sectionFor(i, now);
    if (!kind) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), i]);
  }
  const sections = ORDER.flatMap((kind) => {
    const items = (byKind.get(kind) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
    return items.length ? [{ kind, items }] : [];
  });
  return { live, sections, badge: byKind.get("yourTurn")?.length ?? 0 };
}
