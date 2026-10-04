import { getPlatformProxy } from "wrangler";
import schema from "../../schema.sql?raw";

/**
 * A real (local, in-memory) D1 with schema.sql applied, reachable from Node through wrangler's
 * platform proxy — so unit tests exercise real SQL and their coverage is measured, unlike the
 * workerd-hosted integration suite.
 */
export interface TestD1 {
  db: D1Database;
  /** Empties every table (between tests). */
  reset(): Promise<void>;
  dispose(): Promise<void>;
}

const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);

export async function openTestD1(): Promise<TestD1> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: "test/support/d1.wrangler.jsonc",
    persist: false,
  });
  const db = proxy.env.DB;
  await db.batch(statements.map((s) => db.prepare(s)));
  return {
    db,
    reset: async () => {
      // Children before parents (schema.sql creates parents first), for the foreign keys.
      await db.batch([...tables].reverse().map((t) => db.prepare(`DELETE FROM ${t}`)));
    },
    dispose: () => proxy.dispose(),
  };
}
