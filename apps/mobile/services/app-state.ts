import type { Instance, InstanceReport, Manifest } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { type Identity, loadIdentity, type SecureStorage, saveIdentity } from "./identity";
import type { ReturnPill } from "./leave-game";
import { BandSchema, type InstanceSource, type OgsApi, OgsApiError } from "./ogs-api";

/**
 * The app's shared data: who this phone belongs to, the household's games and instances, and the
 * return pill. One small external store (useSyncExternalStore in screens); the API is injected.
 */

export interface AppData {
  identity: Identity | null;
  catalogue: Manifest[];
  library: Manifest[];
  instances: Instance[];
  status: "idle" | "loading" | "ready" | "offline";
  error: string | null;
  pill: ReturnPill | null;
}

type Api = Pick<
  OgsApi,
  | "createHousehold"
  | "catalogue"
  | "library"
  | "setLibrary"
  | "instances"
  | "reportInstance"
  | "fetchManifest"
>;

const DraftSchema = z.object({
  name: z.string(),
  people: z.array(z.object({ name: z.string(), band: BandSchema, sticker: z.string() })),
});
type Draft = z.infer<typeof DraftSchema>;
const DRAFT_KEY = "ogs.family-draft";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createAppState(opts: {
  api: Api;
  storage: SecureStorage;
  deviceName: string;
  /** Mints this phone's device id (its token's device claim). */
  newDeviceId: () => string;
}) {
  let appIds: string[] = [];
  const libraryOf = (catalogue: Manifest[]) =>
    appIds.flatMap((id) => catalogue.filter((g) => g.appId === id));
  let data: AppData = {
    identity: null,
    catalogue: [],
    library: [],
    instances: [],
    status: "idle",
    error: null,
    pill: null,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<AppData>) => {
    data = { ...data, ...patch };
    for (const l of listeners) l();
  };

  async function readDraft(): Promise<Draft | null> {
    const raw = await opts.storage.getItemAsync(DRAFT_KEY);
    if (!raw) return null;
    try {
      const parsed = DraftSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async function createFrom(draft: Draft) {
    try {
      const created = await opts.api.createHousehold({
        ...draft,
        device: { deviceId: opts.newDeviceId(), name: opts.deviceName, personIndex: 0 },
      });
      const identity: Identity = { ...created, householdName: draft.name };
      await saveIdentity(opts.storage, identity);
      await opts.storage.deleteItemAsync(DRAFT_KEY);
      set({ identity, error: null });
    } catch (err) {
      set({ error: `Can't reach OGS to set up your household yet (${message(err)})` });
    }
  }

  return {
    getSnapshot: (): AppData => data,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Load the stored identity; finish a household setup that couldn't reach OGS earlier. */
    async init() {
      const identity = await loadIdentity(opts.storage);
      if (identity) {
        set({ identity });
        return;
      }
      const draft = await readDraft();
      if (draft) await createFrom(draft);
    },
    /** First run: create the household (kept as a draft and retried if OGS is unreachable). */
    async ensureHousehold(name: string, people: Draft["people"]) {
      if (data.identity) return;
      const draft = { name, people };
      await opts.storage.setItemAsync(DRAFT_KEY, JSON.stringify(draft));
      await createFrom(draft);
    },
    /** Library = the household's appIds, as catalogue manifests, in the household's order. */
    async refresh() {
      set({ status: data.status === "ready" ? "ready" : "loading" });
      try {
        const [catalogue, ids, instances] = await Promise.all([
          opts.api.catalogue(),
          data.identity ? opts.api.library() : Promise.resolve(appIds),
          data.identity ? opts.api.instances() : Promise.resolve(data.instances),
        ]);
        appIds = ids;
        set({ catalogue, library: libraryOf(catalogue), instances, status: "ready", error: null });
      } catch (err) {
        set({ status: "offline", error: message(err) });
      }
    },
    async addGame(appId: string) {
      if (appIds.includes(appId)) return;
      appIds = await opts.api.setLibrary([...appIds, appId]);
      set({ library: libraryOf(data.catalogue) });
    },
    /** Add by link: the manifest must parse; OGS only takes catalogue games for now. */
    async addByLink(url: string): Promise<Manifest> {
      const manifest = await opts.api.fetchManifest(url);
      if (!data.catalogue.some((g) => g.appId === manifest.appId))
        throw new OgsApiError(
          "NOT_IN_CATALOGUE",
          `${manifest.name} isn't in the OGS catalogue yet, so it can't be added by link.`,
          0,
        );
      await this.addGame(manifest.appId);
      return manifest;
    },
    async report(report: InstanceReport, source: InstanceSource) {
      const saved = await opts.api.reportInstance(report, source);
      set({
        instances: [saved, ...data.instances.filter((i) => i.instanceId !== saved.instanceId)],
      });
    },
    setPill(pill: ReturnPill | null) {
      set({ pill });
    },
  };
}

export type AppState = ReturnType<typeof createAppState>;
