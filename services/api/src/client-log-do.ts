import { DurableObject } from "cloudflare:workers";
import {
  appendCapped,
  type BucketFilter,
  type BucketSummary,
  type BucketTouch,
  filterIndex,
  TTL_MS,
  touchIndex,
} from "./lib/client-log-store";
import type { Env } from "./types";

/**
 * One bucket of the stored client log (a launch's last events), or the "index" of recent buckets
 * (src/lib/client-log-store.ts). Deleted TTL_MS after its last write.
 */
export class ClientLog extends DurableObject<Env> {
  async append(lines: string[]): Promise<void> {
    const current = (await this.ctx.storage.get<string[]>("lines")) ?? [];
    await this.ctx.storage.put("lines", appendCapped(current, lines));
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  async read(limit: number): Promise<string[]> {
    return ((await this.ctx.storage.get<string[]>("lines")) ?? []).slice(-limit);
  }

  async touch(t: BucketTouch): Promise<void> {
    const list = (await this.ctx.storage.get<BucketSummary[]>("buckets")) ?? [];
    await this.ctx.storage.put("buckets", touchIndex(list, t));
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  async recent(f: BucketFilter): Promise<BucketSummary[]> {
    return filterIndex((await this.ctx.storage.get<BucketSummary[]>("buckets")) ?? [], f);
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
