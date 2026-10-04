import schema from "../../schema.sql?raw";
import { createD1 } from "./d1";

/**
 * test/support/d1.ts for the mutation suite (vitest.mutation.config.mts): the same TestD1, on
 * node:sqlite instead of wrangler's platform proxy, which starts workerd for every test file and
 * makes each mutant run tens of seconds slower.
 */
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);

export async function openTestD1() {
  const db = createD1();
  await db.batch(statements.map((s) => db.prepare(s)));
  return {
    db,
    reset: async () => {
      await db.batch([...tables].reverse().map((t) => db.prepare(`DELETE FROM ${t}`)));
    },
    dispose: async () => {},
  };
}
