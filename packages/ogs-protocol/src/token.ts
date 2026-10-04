import { z } from "zod";

/**
 * Claims OGS signs into every app token: a phone or tablet token for one profile, or a launcher
 * token for one couch session (its `sub` is the session's host).
 */
export const ClaimsSchema = z
  .object({
    /** Profile id (a launcher token: the host's). */
    sub: z.string().min(1),
    /** Device id. */
    did: z.string().min(1),
    /** What kind of client this token is for. */
    kind: z.enum(["phone", "tablet", "launcher"]),
    /** The couch session a launcher token is for. Launcher tokens only. */
    sid: z.string().min(1).optional(),
    /** Expiry, seconds since epoch. */
    exp: z.number().int().positive(),
  })
  .refine((c) => (c.kind === "launcher") === (c.sid !== undefined), {
    message: "a launcher token names its session; a phone or tablet token doesn't",
  });
export type Claims = z.infer<typeof ClaimsSchema>;
