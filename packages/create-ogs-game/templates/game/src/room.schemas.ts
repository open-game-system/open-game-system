import { z } from "zod";
import { COLORS } from "./game/rules";

/** Most phones in one room (the TV is not a seat). */
export const MAX_PLAYERS = 8;

export const ColorSchema = z.enum(COLORS);

/** What a phone or the TV may send. Parsed by actor-kit before the machine sees it. */
export const RoomClientEventSchema = z.discriminatedUnion("type", [
  /**
   * Take a seat. `ogsToken`: the player's OGS game token (OGS app or this game's own app); the Room
   * verifies it and names the seat from it. Without one, `name` is what the player typed.
   */
  z.object({
    type: z.literal("JOIN"),
    name: z.string().max(40).optional(),
    ogsToken: z.string().max(8192).optional(),
  }),
  /** The host phone starts the game (lobby) or a new one (over). */
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("PICK"), color: ColorSchema }),
  /** A screen saw a deadline pass: the room checks it against its own clock (a sleeping room wakes). */
  z.object({ type: z.literal("TICK") }),
]);

export const RoomServiceEventSchema = z.never();
export const RoomInputPropsSchema = z.object({});

export const PhaseSchema = z.enum(["lobby", "show", "answer", "reveal", "over"]);

export const ShapeSchema = z.object({
  color: ColorSchema,
  x: z.number(),
  y: z.number(),
  drift: z.number(),
  size: z.number(),
});

export const PlayerViewSchema = z.object({
  seat: z.string(),
  name: z.string(),
  score: z.number(),
  answered: z.boolean(),
  /** After a reveal: did this player get the round? */
  correct: z.boolean().nullable(),
});

/** Every screen sees this. Nothing here gives away the answer before the reveal. */
export const PublicViewSchema = z.object({
  roomCode: z.string(),
  phase: PhaseSchema,
  /** 0-based round now being played. */
  round: z.number(),
  rounds: z.number(),
  /** When the current phase ends (ms since epoch), or null in the lobby and at the end. */
  endsAt: z.number().nullable(),
  players: z.array(PlayerViewSchema),
  /** The kites, only while the TV shows them. */
  shapes: z.array(ShapeSchema),
  reveal: z
    .object({
      answer: ColorSchema,
      counts: z.object({ coral: z.number(), sky: z.number(), lime: z.number(), gold: z.number() }),
    })
    .nullable(),
  winners: z.array(z.string()),
});

/** Each caller gets only its own slot. An unseated phone gets `{}`. */
export const PrivateViewSchema = z.union([
  z.object({ role: z.literal("tv") }),
  z.object({
    role: z.literal("player"),
    seat: z.string(),
    host: z.boolean(),
    pick: ColorSchema.nullable(),
  }),
  z.object({}).strict(),
]);

export const SnapshotSchema = z.object({
  public: PublicViewSchema,
  private: PrivateViewSchema,
  /** The machine's state (room.machine.ts). */
  value: z.enum(["route", "lobby", "show", "answer", "reveal", "over"]),
});

/** What the Worker injects into /tv and /join pages (`<script id="boot">`). */
export const BootSchema = z.object({
  host: z.string(),
  roomCode: z.string(),
  accessToken: z.string(),
  checksum: z.string(),
  snapshot: SnapshotSchema,
  /** The TV page of this room (the phone hands it to the cast). */
  tvUrl: z.string(),
  /** Where another phone joins this room. */
  joinUrl: z.string(),
});
