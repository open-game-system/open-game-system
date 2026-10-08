import { env } from "cloudflare:test";
import schema from "../../schema.sql?raw";
import { hashApiKey, NOTIFICATIONS_SCOPE } from "../../src/lib/api-keys";
import { TEST_GAME_API_KEY } from "./helpers";

// The canonical schema, applied statement by statement (the Workers runtime has no filesystem).
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s: string) => s.trim())
  .filter((s: string) => s.length > 0);

for (const stmt of statements) {
  await env.DB.prepare(stmt).run();
}

// A game API key for Codebreakers (stored hashed, like issue-key does): TEST_GAME_API_KEY.
await env.DB.prepare(
  `INSERT OR IGNORE INTO game_api_keys (id, app_id, prefix, key_hash, scope, created_at)
   VALUES ('k-test', 'codebreakers', ?, ?, ?, 1)`,
)
  .bind(TEST_GAME_API_KEY.slice(0, 12), await hashApiKey(TEST_GAME_API_KEY), NOTIFICATIONS_SCOPE)
  .run();
