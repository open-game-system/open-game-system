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

/** One sitting of one game for one profile. Reported by the game (bridge or server) or recorded by OGS on visit. */
export const InstanceSchema = z.object({
  instanceId: z.string().min(1),
  appId: z.string().min(1),
  profileId: z.string().min(1),
  status: InstanceStatusSchema,
  title: z.string().default(""),
  detail: z.string().default(""),
  /** For async games: true when it's this profile's move. */
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

/** What a game reports (the profile comes from its token, the time from the receiver). */
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

/** Lobby / suspended / active: tonight when it starts within a day, else paused. */
function inFlightSection(i: Instance, now: number): SectionKind {
  const startsSoon = i.startsAt !== undefined && i.startsAt >= now && i.startsAt - now <= DAY;
  return startsSoon ? "tonight" : "paused";
}

const SECTION_BY_STATUS: Record<
  Instance["status"],
  (i: Instance, now: number) => SectionKind | null
> = {
  expired: () => null,
  completed: (i, now) => (now - i.updatedAt <= DAY ? "finished" : null),
  waiting: (i) => (i.yourTurn ? "yourTurn" : "waiting"),
  lobby: inFlightSection,
  suspended: inFlightSection,
  active: inFlightSection,
};

/** Every instance but the live one, grouped by section (hidden ones dropped). */
function bySection(instances: Instance[], live: Instance | null, now: number) {
  const byKind = new Map<SectionKind, Instance[]>();
  for (const i of instances) {
    const kind = i === live ? null : SECTION_BY_STATUS[i.status](i, now);
    if (kind) byKind.set(kind, [...(byKind.get(kind) ?? []), i]);
  }
  return byKind;
}

/**
 * The Playing tab: the live game pinned, then everything in flight ordered by what needs you.
 * Silent instances past their game's TTL are hidden; each sitting (instance id) is its own entry.
 */
export function playingView(
  instances: Instance[],
  opts: { now: number; liveInstanceIds: string[]; ttlFor: (appId: string) => number },
): PlayingView {
  const { now, liveInstanceIds, ttlFor } = opts;
  const fresh = instances.filter(
    (i) => i.status === "completed" || now - i.updatedAt <= ttlFor(i.appId),
  );
  // Every sitting is its own entry, Tier 0 visits too (one id per sitting, so a sitting appears once).
  const kept = fresh;
  const live =
    kept.find((i) => liveInstanceIds.includes(i.instanceId) && i.status !== "completed") ?? null;
  const byKind = bySection(kept, live, now);
  const sections = ORDER.flatMap((kind) => {
    const items = (byKind.get(kind) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
    return items.length ? [{ kind, items }] : [];
  });
  return { live, sections, badge: byKind.get("yourTurn")?.length ?? 0 };
}
