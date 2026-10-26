import { createAccessToken } from "actor-kit/server";
import { logLines } from "./client-events";
import { GAME } from "./game.config";
import { actorKitRouter, type WorkerEnv } from "./room.server";
import type { Boot } from "./room.types";
import { newRoomCode, route, TOKEN } from "./routes";

export { Room } from "./room.server";

const html = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

/** JSON safe to inline inside a <script> tag. */
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const stub = (env: WorkerEnv, roomCode: string) => env.ROOM.get(env.ROOM.idFromName(roomCode));

/**
 * `/host`: a phone (the app's gameUrl) makes a room with its own TV caller, then goes in as the
 * host. `tv` in the join URL is the TV's token, so the phone can hand the TV page to the cast.
 */
async function host(url: URL, env: WorkerEnv): Promise<Response> {
  const roomCode = newRoomCode();
  const tvToken = crypto.randomUUID();
  await stub(env, roomCode).spawn({
    actorType: "room",
    actorId: roomCode,
    caller: { id: tvToken, type: "client" },
    input: {},
  });
  const join = new URL(`/join/${roomCode}`, url);
  join.searchParams.set("t", crypto.randomUUID());
  join.searchParams.set("tv", tvToken);
  return Response.redirect(join.toString(), 302);
}

/** `/tv/CODE?t=…` and `/join/CODE?t=…`: the page with the caller's snapshot and access token inlined. */
async function page(req: Request, env: WorkerEnv, which: "tv" | "join", roomCode: string): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  if (!TOKEN.test(token)) {
    url.searchParams.set("t", crypto.randomUUID());
    return Response.redirect(url.toString(), 302);
  }
  const caller = { id: token, type: "client" as const };
  let payload: Awaited<ReturnType<ReturnType<typeof stub>["getSnapshot"]>>;
  try {
    payload = await stub(env, roomCode).getSnapshot(caller);
  } catch {
    return new Response(`No room ${roomCode}. Start a new one at /host.`, { status: 404, headers: html });
  }
  const accessToken = await createAccessToken({
    signingKey: env.ACTOR_KIT_SECRET,
    actorId: roomCode,
    actorType: "room",
    callerId: caller.id,
    callerType: caller.type,
  });
  const tvToken = which === "join" ? url.searchParams.get("tv") : token;
  const tvUrl = new URL(`/tv/${roomCode}`, url);
  if (tvToken && TOKEN.test(tvToken)) tvUrl.searchParams.set("t", tvToken);
  const boot: Boot = {
    host: url.host,
    roomCode,
    accessToken,
    checksum: payload.checksum,
    snapshot: payload.snapshot,
    tvUrl: tvUrl.toString(),
    joinUrl: new URL(`/join/${roomCode}`, url).toString(),
  };
  const asset = await (await env.ASSETS.fetch(new URL(`/${which === "tv" ? "tv" : "phone"}.html`, url))).text();
  const body = asset.replace("<!--BOOT-->", `<script id="boot" type="application/json">${inlineJson(boot)}</script>`);
  return new Response(body, { headers: html });
}

async function events(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const lines = logLines(body, { appId: GAME.appId, userAgent: req.headers.get("User-Agent") ?? "" });
  if (!lines) return new Response("bad events", { status: 400 });
  for (const line of lines) console.log(line);
  return new Response(null, { status: 204 });
}

export default {
  async fetch(req: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const r = route(req.method, url);
    switch (r.kind) {
      case "host":
        return host(url, env);
      case "follow":
        return Response.redirect(new URL(`/join/${r.roomCode}`, url).toString(), 302);
      case "page":
        return page(req, env, r.page, r.roomCode);
      case "api":
        return actorKitRouter(req, env, ctx);
      case "events":
        return events(req);
      case "health":
        return Response.json({ ok: true, app: GAME.appId });
      case "asset":
        return env.ASSETS.fetch(req);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
