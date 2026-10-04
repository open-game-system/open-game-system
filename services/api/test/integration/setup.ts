import { env } from "cloudflare:test";
import schema from "../../schema.sql?raw";

// The canonical schema, applied statement by statement (the Workers runtime has no filesystem).
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s: string) => s.trim())
  .filter((s: string) => s.length > 0);

for (const stmt of statements) {
  await env.DB.prepare(stmt).run();
}

// Seed test API key
await env.DB.prepare("INSERT OR IGNORE INTO api_keys (key, game_id, game_name) VALUES (?, ?, ?)")
  .bind("test-api-key", "trivia-jam", "Trivia Jam")
  .run();
