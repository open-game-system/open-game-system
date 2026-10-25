import { z } from "zod";
import { GamePlayerSchema } from "./game-token";
import { InstanceReportSchema } from "./instance";
import { RoomIdSchema, RosterEntrySchema } from "./session";

/**
 * How much the TV can draw, strongest first. The TV that renders the launcher says it (the Cast
 * receiver measures the Chromecast; docs/specification.md "Render tiers" says what a game should do
 * at each). `full`: a strong TV, 3D with effects at 1080p. `lite`: a weak TV GPU (Chromecast with
 * Google TV), 3D at a lower resolution without post-processing. `minimal`: too weak for 3D (older
 * Chromecasts, software GL): 2D only.
 */
export const RENDER_TIERS = ["full", "lite", "minimal"] as const;
export const RenderTierSchema = z.enum(RENDER_TIERS);
export type RenderTier = z.infer<typeof RenderTierSchema>;

/**
 * postMessage between the TV launcher and the game's TV page it frames. All optional for games:
 * a game that answers nothing still runs; it just can't report a resume point.
 */
export const LauncherToGameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ogs:start"),
    instanceId: z.string(),
    mode: z.enum(["continue", "new"]),
    roster: z.array(RosterEntrySchema),
    /** A game token for this game and session (aud = appId, players + sid); "" when there is none. */
    token: z.string(),
    /** Who's on the couch: profile id, @id, name, avatar. */
    players: z.array(GamePlayerSchema).optional(),
    /** Join this room (another couch made it) instead of making one (multiCouch games). */
    room: RoomIdSchema.optional(),
    /** What this TV can draw. Absent: the TV didn't say (treat it as `full`). */
    tier: RenderTierSchema.optional(),
  }),
  z.object({ type: z.literal("ogs:suspend") }),
  z.object({ type: z.literal("ogs:resume") }),
]);
export type LauncherToGame = z.infer<typeof LauncherToGameSchema>;

export const GameToLauncherSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ogs:ready") }),
  z.object({ type: z.literal("ogs:resume-point"), label: z.string() }),
  /** The room the TV page shows (multiCouch games): the couch session keeps it on the sitting. */
  z.object({ type: z.literal("ogs:room"), room: RoomIdSchema }),
  z.object({ type: z.literal("ogs:instance"), report: InstanceReportSchema }),
]);
export type GameToLauncher = z.infer<typeof GameToLauncherSchema>;

/** The app-bridge store a game page uses (in the app's WebView) to report its instance. */
export const OgsBridgeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INSTANCE_REPORT"), report: InstanceReportSchema }),
]);
export type OgsBridgeEvent = z.infer<typeof OgsBridgeEventSchema>;
