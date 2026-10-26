import { z } from "zod";

/** One line of wrangler's output file (WRANGLER_OUTPUT_FILE_PATH, ND-JSON). Only `deploy` matters. */
const DeployLineSchema = z.object({
  type: z.literal("deploy"),
  targets: z.array(z.string()).optional(),
});

/** The workers.dev URL wrangler deployed to, from its output file; null if it names none. */
export function deployedUrl(ndjson: string): string | null {
  for (const line of ndjson.split("\n").reverse()) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = DeployLineSchema.safeParse(raw);
    const url = parsed.success ? parsed.data.targets?.find((t) => t.startsWith("https://")) : undefined;
    if (url) return url.replace(/\/$/, "");
  }
  return null;
}

/** deploys.json: where each env of this game is deployed. The app reads it (app/app.config.ts). */
export const DeploysSchema = z.object({
  preview: z.string().url().optional(),
  production: z.string().url().optional(),
});
export type Deploys = z.infer<typeof DeploysSchema>;

export function withDeploy(current: unknown, env: "preview" | "production", url: string): Deploys {
  const parsed = DeploysSchema.safeParse(current);
  return { ...(parsed.success ? parsed.data : {}), [env]: url };
}
