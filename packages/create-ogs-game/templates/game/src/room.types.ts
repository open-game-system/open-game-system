import type { ActorKitSystemEvent, BaseActorKitEvent, WithActorKitEvent, WithActorKitInput } from "actor-kit";
import type { z } from "zod";
import type { Env } from "./env";
import type { Color, Round } from "./game/rules";
import type {
  BootSchema,
  PhaseSchema,
  PrivateViewSchema,
  PublicViewSchema,
  RoomClientEventSchema,
  RoomInputPropsSchema,
} from "./room.schemas";

export type RoomClientEvent = z.infer<typeof RoomClientEventSchema>;
export type RoomInput = WithActorKitInput<z.infer<typeof RoomInputPropsSchema>, Env>;
export type Phase = z.infer<typeof PhaseSchema>;
export type PublicView = z.infer<typeof PublicViewSchema>;
export type PrivateView = z.infer<typeof PrivateViewSchema>;
export type Boot = z.infer<typeof BootSchema>;

/**
 * A JOIN whose OGS token the Room verified (room.server.ts): the seat takes the token's name. Not in
 * the client schema, so only the server can send it.
 */
export type OgsJoinEvent = { type: "OGS_JOIN"; profile: { id: string; name: string } };

export type RoomEvent =
  | (WithActorKitEvent<RoomClientEvent, "client"> & BaseActorKitEvent<Env>)
  | (WithActorKitEvent<OgsJoinEvent, "client"> & BaseActorKitEvent<Env>)
  | (ActorKitSystemEvent & BaseActorKitEvent<Env>);

/** One phone's seat. `callerId` is its rejoin token: never sent to any screen. */
export type Seat = {
  callerId: string;
  seat: string;
  name: string;
  ogsId: string | null;
  score: number;
  pick: Color | null;
  correct: boolean | null;
};

/** The room's truth. Every screen's view is derived from it (game/views.ts). Never sent. */
export type ServerState = {
  roomCode: string;
  tvId: string;
  seed: number;
  phase: Phase;
  round: number;
  endsAt: number | null;
  seats: Seat[];
  current: Round | null;
};

export type RoomContext = {
  public: PublicView;
  private: Record<string, PrivateView>;
  server: ServerState;
};
