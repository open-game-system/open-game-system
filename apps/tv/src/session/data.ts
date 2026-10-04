import {
  type Instance,
  InstanceSchema,
  type Manifest,
  ManifestSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** A sticker id ("bear") from the household's painted set, or an image URL. */
  sticker: z.string().min(1),
});
export type Person = z.infer<typeof PersonSchema>;

export const HouseholdSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  people: z.array(PersonSchema),
});
export type Household = z.infer<typeof HouseholdSchema>;

/** Accept `{ key: value }` or the bare value: the API's envelope is not pinned yet. */
const enveloped = <T extends z.ZodTypeAny>(key: string, schema: T) =>
  z.union([z.object({ [key]: schema }).transform((o) => o[key] as z.infer<T>), schema]);

/** One bad manifest or instance must not blank the TV: keep the ones that parse. */
const lenientList = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(z.unknown()).transform((items) =>
    items.flatMap((i) => {
      const r = schema.safeParse(i);
      return r.success ? [r.data as z.infer<T>] : [];
    }),
  );

export const CatalogueResponse = enveloped("games", lenientList(ManifestSchema));
export const InstancesResponse = enveloped("instances", lenientList(InstanceSchema));
export const HouseholdResponse = enveloped("household", HouseholdSchema);

export interface LauncherData {
  games: Manifest[];
  instances: Instance[];
  household: Household;
}

export function stickerUrl(sticker: string): string {
  return /^[a-z-]+$/.test(sticker) ? `/art/story-nook/char-${sticker}.webp` : sticker;
}

export async function fetchLauncherData(opts: {
  api: string;
  token: string;
  householdId: string;
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
  const hid = encodeURIComponent(opts.householdId);
  const [games, instances, household] = await Promise.all([
    get("/api/v1/catalogue", CatalogueResponse),
    get(`/api/v1/households/${hid}/instances`, InstancesResponse),
    get(`/api/v1/households/${hid}`, HouseholdResponse),
  ]);
  return { games, instances, household };
}
