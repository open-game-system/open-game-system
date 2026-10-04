import { z } from "zod";

/** Claims OGS signs for every device it hands a game or a session socket. */
export const ClaimsSchema = z.object({
  /** Household id. */
  hid: z.string().min(1),
  /** Device id. */
  did: z.string().min(1),
  /** Person paired to the device, if any (a kid's iPad is paired to the kid). */
  pid: z.string().min(1).optional(),
  /** What kind of client this token is for. */
  kind: z.enum(["phone", "tablet", "launcher"]),
  /** Expiry, seconds since epoch. */
  exp: z.number().int().positive(),
});
export type Claims = z.infer<typeof ClaimsSchema>;
