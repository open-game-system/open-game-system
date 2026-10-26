import { verifyOgsToken } from "@open-game-system/profile-kit/server";
import { createActorKitRouter, createMachineServer } from "actor-kit/worker";
import { z } from "zod";
import type { Env } from "./env";
import { GAME } from "./game.config";
import { roomMachine } from "./room.machine";
import { RoomClientEventSchema, RoomInputPropsSchema, RoomServiceEventSchema } from "./room.schemas";
import { type TokenVerifier, trustJoin } from "./ogs-join";

const RoomMachineServer = createMachineServer({
  machine: roomMachine,
  schemas: {
    clientEvent: RoomClientEventSchema,
    serviceEvent: RoomServiceEventSchema,
    inputProps: RoomInputPropsSchema,
  },
  options: { persisted: true },
});

/** actor-kit keeps each socket's caller in its attachment. */
const AttachmentSchema = z.object({
  caller: z.object({ id: z.string(), type: z.enum(["client", "service", "system"]) }),
});

/**
 * One Durable Object per room. A JOIN with an OGS token is verified here (async, so before the
 * machine sees it): a valid token becomes OGS_JOIN and names the seat; anything else is an
 * ordinary typed-name JOIN. Every other message goes to actor-kit unchanged.
 */
export class Room extends RoomMachineServer {
  readonly #verify: TokenVerifier;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.#verify = (token) => verifyOgsToken(token, { appId: GAME.appId, jwksUrl: env.OGS_JWKS_URL });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = AttachmentSchema.safeParse(ws.deserializeAttachment());
    const event = attachment.success ? await trustJoin(message, this.#verify) : null;
    if (event && attachment.success && attachment.data.caller.type === "client") {
      // Like actor-kit's own delivery: the event plus the socket's caller (actor-kit adds env and storage).
      const withCaller = { ...event, caller: { id: attachment.data.caller.id, type: "client" as const } };
      this.send(withCaller);
      return;
    }
    return super.webSocketMessage?.(ws, message);
  }
}

export interface WorkerEnv extends Env {
  ASSETS: Fetcher;
  ROOM: DurableObjectNamespace<Room>;
}

export const actorKitRouter = createActorKitRouter<WorkerEnv>(["room"]);
