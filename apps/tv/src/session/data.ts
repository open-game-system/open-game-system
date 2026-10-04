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
export const HouseholdResponse = z.union([
  z.object({ household: HouseholdSchema }).transform((o) => o.household),
  HouseholdSchema,
]);

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
