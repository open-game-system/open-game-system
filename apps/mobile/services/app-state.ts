import type { Instance, InstanceReport, Manifest } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { type Identity, loadIdentity, type SecureStorage, saveIdentity } from "./identity";
import type { ReturnPill } from "./leave-game";
import { type AddToLibrary, BandSchema, type InstanceSource, type OgsApi } from "./ogs-api";

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
  "createHousehold" | "catalogue" | "library" | "addToLibrary" | "instances" | "reportInstance"
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
  platform: string;
}) {
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
        device: { name: opts.deviceName, platform: opts.platform },
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
    async refresh() {
      set({ status: data.status === "ready" ? "ready" : "loading" });
      try {
        const [catalogue, library, instances] = await Promise.all([
          opts.api.catalogue(),
          data.identity ? opts.api.library() : Promise.resolve(data.library),
          data.identity ? opts.api.instances() : Promise.resolve(data.instances),
        ]);
        set({ catalogue, library, instances, status: "ready", error: null });
      } catch (err) {
        set({ status: "offline", error: message(err) });
      }
    },
    async addGame(add: AddToLibrary) {
      const library = await opts.api.addToLibrary(add);
      set({ library });
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
