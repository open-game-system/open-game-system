import {
  type Instance,
  type InstanceReport,
  InstanceSchema,
  type Manifest,
  ManifestSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * The OGS API client (services/api). Every response is parsed here, at the boundary; screens only
 * ever see typed manifests, instances and identities. `fetch` is injected so tests need no server.
 */

export class OgsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OgsApiError";
  }
}

export const BandSchema = z.enum(["grownup", "kid", "little"]);
export type Band = z.infer<typeof BandSchema>;

export const PersonSchema = z.object({
  personId: z.string().min(1),
  name: z.string().min(1),
  band: BandSchema,
  sticker: z.string().min(1),
});
export type Person = z.infer<typeof PersonSchema>;

const HouseholdCreatedSchema = z.object({
  householdId: z.string().min(1),
  token: z.string().min(1),
  people: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      band: BandSchema,
      sticker: z.string(),
    }),
  ),
});
export interface HouseholdCreated {
  householdId: string;
  deviceId: string;
  token: string;
  people: Person[];
}

export interface NewHousehold {
  name: string;
  people: { name: string; band: Band; sticker: string }[];
  /** This phone: its id is minted on the phone and becomes the token's device claim. */
  device: { deviceId: string; name: string; personIndex?: number };
}

const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), status: z.number() }),
});
const TokenSchema = z.object({ token: z.string().min(1) });
const ListSchema = z.array(z.unknown());
const LibrarySchema = z.object({ appIds: z.array(z.string()) });

export type InstanceSource = Exclude<Instance["source"], "server">;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface OgsApiOptions {
  baseUrl: string;
  fetch: FetchLike;
  /** The stored household identity, or null before onboarding created one. */
  auth: () => { householdId: string; token: string } | null;
}

/** Drop what doesn't parse (one bad manifest must not empty the Library), keep the rest. */
function parseEach<T>(items: unknown[], parse: (x: unknown) => { success: boolean; data?: T }) {
  const out: T[] = [];
  for (const item of items) {
    const r = parse(item);
    if (r.success && r.data !== undefined) out.push(r.data);
    else console.warn("[ogs-api] skipped an item that does not match the protocol");
  }
  return out;
}

const manifests = (items: unknown[]): Manifest[] =>
  parseEach(items, (x) => ManifestSchema.safeParse(x));
const instances = (items: unknown[]): Instance[] =>
  parseEach(items, (x) => InstanceSchema.safeParse(x));

export function createOgsApi({ baseUrl, fetch, auth }: OgsApiOptions) {
  async function request(
    path: string,
    init: { method?: string; body?: unknown; authed?: boolean } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.authed) {
      const id = auth();
      if (!id) throw new OgsApiError("NO_HOUSEHOLD", "This phone has no household yet", 0);
      headers.Authorization = `Bearer ${id.token}`;
    }
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (err) {
      throw new OgsApiError("OFFLINE", `Can't reach OGS: ${String(err)}`, 0);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const parsed = ErrorBodySchema.safeParse(json);
      if (parsed.success) {
        const { code, message, status } = parsed.data.error;
        throw new OgsApiError(code, message, status);
      }
      throw new OgsApiError(`HTTP_${res.status}`, `OGS answered ${res.status}`, res.status);
    }
    return json;
  }

  function parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const r = schema.safeParse(data);
    if (!r.success) throw new OgsApiError("BAD_RESPONSE", r.error.message, 0);
    return r.data;
  }

  const household = () => {
    const id = auth();
    if (!id) throw new OgsApiError("NO_HOUSEHOLD", "This phone has no household yet", 0);
    return `/api/v1/households/${encodeURIComponent(id.householdId)}`;
  };

  return {
    async createHousehold(input: NewHousehold): Promise<HouseholdCreated> {
      const data = await request("/api/v1/households", {
        method: "POST",
        body: { ...input, device: { ...input.device, kind: "phone" } },
      });
      const created = parse(HouseholdCreatedSchema, data);
      return {
        householdId: created.householdId,
        deviceId: input.device.deviceId,
        token: created.token,
        people: created.people.map(({ id, ...p }) => ({ personId: id, ...p })),
      };
    },
    /** A short-lived token the TV launcher uses to join this household's couch session. */
    async launcherToken(): Promise<string> {
      const data = await request(`${household()}/launcher-token`, { method: "POST", authed: true });
      return parse(TokenSchema, data).token;
    },
    async catalogue(): Promise<Manifest[]> {
      return manifests(parse(ListSchema, await request("/api/v1/catalogue")));
    },
    /** The household's games, as catalogue appIds in the household's order. */
    async library(): Promise<string[]> {
      const data = await request(`${household()}/library`, { authed: true });
      return parse(LibrarySchema, data).appIds;
    },
    /** Replace the household's games (catalogue ids only); returns the saved list. */
    async setLibrary(appIds: string[]): Promise<string[]> {
      const data = await request(`${household()}/library`, {
        method: "PUT",
        body: { appIds },
        authed: true,
      });
      return parse(LibrarySchema, data).appIds;
    },
    async instances(): Promise<Instance[]> {
      const data = await request(`${household()}/instances`, { authed: true });
      return instances(parse(ListSchema, data));
    },
    async reportInstance(report: InstanceReport, source: InstanceSource): Promise<Instance> {
      const data = await request(`${household()}/instances`, {
        method: "POST",
        body: { ...report, source },
        authed: true,
      });
      const r = InstanceSchema.safeParse(data);
      if (!r.success) throw new OgsApiError("BAD_RESPONSE", r.error.message, 0);
      return r.data;
    },
    /** Add by link: fetch any OGS game's manifest (parsed with the protocol's ManifestSchema). */
    async fetchManifest(url: string): Promise<Manifest> {
      let res: Response;
      try {
        res = await fetch(url, { headers: { Accept: "application/json" } });
      } catch (err) {
        throw new OgsApiError("OFFLINE", `Can't reach ${url}: ${String(err)}`, 0);
      }
      if (!res.ok)
        throw new OgsApiError(`HTTP_${res.status}`, `${url} answered ${res.status}`, res.status);
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      const r = ManifestSchema.safeParse(json);
      if (!r.success)
        throw new OgsApiError("BAD_MANIFEST", "That link isn't an OGS game manifest", 0);
      return r.data;
    },
  };
}

export type OgsApi = ReturnType<typeof createOgsApi>;
