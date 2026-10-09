import { env } from "cloudflare:test";
import schema from "../../schema.sql?raw";
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

// A game API key for Codebreakers (stored hashed, like issue-key does): TEST_GAME_API_KEY. Hashed
// here, not with src's hashApiKey, so a mutant of it fails tests instead of this setup.
const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(TEST_GAME_API_KEY));
const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
await env.DB.prepare(
  `INSERT OR IGNORE INTO game_api_keys (id, app_id, prefix, key_hash, scope, created_at)
   VALUES ('k-test', 'codebreakers', ?, ?, ?, 1)`,
)
  .bind(TEST_GAME_API_KEY.slice(0, 12), keyHash, "notifications:send")
  .run();
