import { basename } from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";
import { AnswersSchema as AppAnswersSchema } from "create-ogs-app/lib";
import { z } from "zod";

/** Names that read as the template itself. Apple rejects near-identical apps (guideline 4.3). */
const TEMPLATE_NAMES = new Set([
  "game",
  "my game",
  "ogs game",
  "party game",
  "new game",
  "test game",
  "example game",
]);

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
}

const titleCase = (slug: string) =>
  slug
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** The same rules as create-ogs-app for what both make, plus a name that isn't the template's. */
export const GameAnswersSchema = z.object({
  dir: z.string().trim().min(1),
  name: AppAnswersSchema.shape.name.refine((n) => !TEMPLATE_NAMES.has(n.toLowerCase()), {
    message:
      "give your game its own name (Apple rejects apps that look like a template, guideline 4.3)",
  }),
  appId: AppAnswersSchema.shape.appId,
  bundleId: AppAnswersSchema.shape.bundleId,
  teamId: AppAnswersSchema.shape.teamId,
});
export type GameAnswers = z.output<typeof GameAnswersSchema>;

export interface Args {
  dir?: string;
  name?: string;
  appId?: string;
  bundleId?: string;
  teamId?: string;
  yes: boolean;
  help: boolean;
}

export type ParseResult = { ok: true; args: Args } | { ok: false; error: string };

const FLAGS = [
  ["name", "name"],
  ["app-id", "appId"],
  ["bundle-id", "bundleId"],
  ["team-id", "teamId"],
] as const;

export function parseArgs(argv: string[]): ParseResult {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1)
    return { ok: false, error: `give one directory, not ${positionals.join(" ")}` };
  const args: Args = { yes: values.yes === true, help: values.help === true };
  if (positionals[0] !== undefined) args.dir = positionals[0];
  for (const [flag, key] of FLAGS) {
    const value = values[flag];
    if (value !== undefined) args[key] = value;
  }
  return { ok: true, args };
}

function parse(argv: string[]) {
  return nodeParseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      name: { type: "string" },
      "app-id": { type: "string" },
      "bundle-id": { type: "string" },
      "team-id": { type: "string" },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });
}

export type AnswersResult = { ok: true; answers: GameAnswers } | { ok: false; error: string };

/** Fills what wasn't given from the name (or the directory), then checks every field. */
export function answersFrom(args: Args): AnswersResult {
  const name = args.name ?? (args.dir ? titleCase(basename(args.dir)) : undefined);
  if (!name)
    return { ok: false, error: 'name your game: create-ogs-game my-game, or --name "Kite Count"' };
  const appId = args.appId ?? slugify(name);
  const parsed = GameAnswersSchema.safeParse({
    dir: args.dir ?? appId,
    name,
    appId,
    bundleId: args.bundleId ?? `tv.${appId.replace(/-/g, "")}.app`,
    teamId: args.teamId ?? "",
  });
  if (parsed.success) return { ok: true, answers: parsed.data };
  const error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  return { ok: false, error };
}
