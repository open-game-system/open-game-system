import { relative, resolve } from "node:path";
import { generateGame } from "./generate";
import { answersFrom, type GameAnswers, parseArgs } from "./options";

export interface CliIO {
  cwd: string;
  log: (message: string) => void;
  error: (message: string) => void;
  templatesDir?: string;
  vendorDir?: string;
}

export const HELP = `Make a phone-and-TV party game with its own App Store app.

  pnpm create ogs-game <dir> [--name "Kite Count"] [--app-id kite-count]
                             [--bundle-id tv.kitecount.app] [--team-id ABCDE12345]

  <dir>          where the game goes (default: the app id)
  --name         the game's name (App Store: 30 characters at most; default: from <dir>)
  --app-id       its OGS catalogue id and URL scheme (default: from the name)
  --bundle-id    the iOS bundle id and Android package (default: tv.<appid>.app)
  --team-id      your Apple Developer Team ID (not needed for the simulator)
  -h, --help     this text`;

export function nextSteps(a: GameAnswers, dir: string): string {
  return `Next (README.md has every step):

  cd ${dir}
  pnpm install && pnpm test          # the game's rules, room and seams
  pnpm dev                           # http://localhost:8787/host on a laptop + phones
  pnpm run deploy:preview            # the Worker, to <you>.workers.dev (writes deploys.json)
  cd app && pnpm install && pnpm e2e:ios   # the app in the iOS Simulator, the TV on its external display

Then TestFlight: README.md "Ship it" (your own Apple account, your own art: guidelines 4.2.6 and 4.3).
${a.teamId ? "" : "No Team ID yet: fine for the simulator; add it to app/app.config.ts before a real iPhone.\n"}`;
}

/** `create-ogs-game [dir] [flags]`. Exit codes: 0 done, 1 could not write, 2 bad input. */
export async function main(argv: string[], io: CliIO): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    io.error(`${parsed.error}\n\n${HELP}`);
    return 2;
  }
  if (parsed.args.help) {
    io.log(HELP);
    return 0;
  }
  const answers = answersFrom(parsed.args);
  if (!answers.ok) {
    io.error(answers.error);
    return 2;
  }
  const a = answers.answers;
  const targetDir = resolve(io.cwd, a.dir);
  try {
    const files = await generateGame({
      targetDir,
      answers: a,
      templatesDir: io.templatesDir,
      vendorDir: io.vendorDir,
    });
    io.log(`Made ${a.name} (${files.length} files): the web game, app/ (iOS + Android), CI.\n`);
    io.log(nextSteps(a, relative(io.cwd, targetDir) || "."));
    return 0;
  } catch (error) {
    // A taken directory, missing vendored packages, a disk error: say what, write nothing more.
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
