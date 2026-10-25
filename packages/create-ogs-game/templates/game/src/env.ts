import type { ActorKitEnv } from "actor-kit";

export interface Env extends ActorKitEnv {
  /** Signs actor-kit access tokens. `.dev.vars` locally; `wrangler secret put` on a deploy. */
  ACTOR_KIT_SECRET: string;
  /** Where OGS publishes the keys that sign game tokens (wrangler var). */
  OGS_JWKS_URL?: string;
}
