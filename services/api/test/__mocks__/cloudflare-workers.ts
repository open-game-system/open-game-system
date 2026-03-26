/**
 * Mock for cloudflare:workers module.
 * Used by Vitest since cloudflare:workers is only available in the Workers runtime.
 */
export class DurableObject {
  ctx: unknown;
  env: unknown;
  constructor(ctx: unknown, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}
