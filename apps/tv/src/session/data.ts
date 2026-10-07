import {
  type Instance,
  InstanceSchema,
  type Manifest,
  ManifestSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

export const ProfileSchema = z.object({
  id: z.string().min(1),
  handle: z.string(),
  name: z.string().min(1),
  /** A sticker id ("bear") from the painted set, or an image URL. */
  sticker: z.string().min(1),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** `GET /sessions/:sid`: the TV this cast is on, its join code and whose games it shows. */
export const CouchSessionSchema = z.object({
  sessionId: z.string().min(1),
  code: z.string().min(1),
  tvName: z.string().min(1),
  host: ProfileSchema,
});
export type CouchSession = z.infer<typeof CouchSessionSchema>;

/** The session as the header names it: on the TV the cast moved to (state.tvName), once it moved. */
export function liveSession(session: CouchSession, state: { tvName?: string }): CouchSession {
  return state.tvName ? { ...session, tvName: state.tvName } : session;
}

export const LibraryResponse = z.object({ appIds: z.array(z.string()) });

/** One bad manifest or instance must not blank the TV: keep the ones that parse. */
const lenientList = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  z.array(z.unknown()).transform((items) =>
    items.flatMap((i) => {
      const r = schema.safeParse(i);
      return r.success ? [r.data] : [];
    }),
  );

/** Each endpoint may answer `{ key: value }` or the bare value: the API's envelope is not pinned yet. */
const Games = lenientList(ManifestSchema);
const Instances = lenientList(InstanceSchema);
export const CatalogueResponse = z.union([
  z.object({ games: Games }).transform((o) => o.games),
  Games,
]);
export const InstancesResponse = z.union([
  z.object({ instances: Instances }).transform((o) => o.instances),
  Instances,
]);

export interface LauncherData {
  /** The host's library, in its order: the only games the TV shows. */
  games: Manifest[];
  instances: Instance[];
  session: CouchSession;
}

/** The catalogue games in the host's library, in the library's order (unknown ids dropped). */
export function libraryGames(catalogue: Manifest[], appIds: string[]): Manifest[] {
  const byId = new Map(catalogue.map((g) => [g.appId, g]));
  return [...new Set(appIds)].flatMap((id) => {
    const g = byId.get(id);
    return g ? [g] : [];
  });
}

export function stickerUrl(sticker: string): string {
  return /^[a-z-]+$/.test(sticker) ? `/art/story-nook/char-${sticker}.webp` : sticker;
}

export async function fetchLauncherData(opts: {
  api: string;
  token: string;
  sessionId: string;
  fetch?: typeof fetch;
}): Promise<LauncherData> {
  const f = opts.fetch ?? fetch;
  const get = async <T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> => {
    const res = await f(`${opts.api}${path}`, {
      headers: { Authorization: `Bearer ${opts.token}` },
    });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return schema.parse(await res.json());
  };
  const [catalogue, session, instances, library] = await Promise.all([
    get("/api/v1/catalogue", CatalogueResponse),
    get(`/api/v1/sessions/${encodeURIComponent(opts.sessionId)}`, CouchSessionSchema),
    get("/api/v1/me/instances", InstancesResponse),
    get("/api/v1/me/library", LibraryResponse),
  ]);
  return { games: libraryGames(catalogue, library.appIds), instances, session };
}
