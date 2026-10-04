import type { Scenario } from "../../harness/types";
import { base, choose, goHome, launch, openGame, playDuel, press, type S } from "./state";

const ALL = ["phone", "tv", "ipad"] as const;
type D = (typeof ALL)[number];
const sc = (id: string, label: string, flow: Scenario<S>["flow"], state: Scenario<S>["state"], devices: readonly D[], build: () => S): Scenario<S> => ({ id, label, flow, state, devices: [...devices], build });

const off = (): S => ({ ...base(), cast: "off" });
const tonight = (): S => ({ ...base(), tonight: ["dad", "juneau", "ava"] });
const playing = (gameId: string): S => {
  const s = launch(tonight(), gameId, ["dad", "juneau", "ava"]);
  return s.view.kind === "game" ? { ...s, view: { ...s.view, phase: "playing" }, savedNote: null } : s;
};
const presses = (s: S, ...bs: Parameters<typeof press>[1][]): S => bs.reduce(press, s);
const ava = (s: S): S => ({ ...s, kidSeat: "ava" });

export const scenarios: Scenario<S>[] = [
  // 1. Cast first
  sc("first-run.01-open", "Open OGS: nothing on the TV yet; one button, Cast to TV", "first-run", "empty", ALL, off),
  sc("first-run.02-pick-tv", "Cast to: the living room TV (the bedroom TV is off)", "first-run", "default", ["phone"], () => ({ ...off(), cast: "picking" })),
  sc("first-run.03-no-tv", "No TV found on this Wi-Fi: three checks, look again", "first-run", "error", ["phone", "tv"], () => ({ ...off(), cast: "none-found" })),
  sc("first-run.04-connecting", "Connecting: the TV boots the OGS home, the phone says what's next", "first-run", "loading", ALL, () => ({ ...off(), cast: "connecting" })),
  sc("first-run.05-launcher-fresh", "The launcher before anyone picked anything; the phone is now the remote", "first-run", "success", ALL, () => ({ ...base(), coach: true })),
  // 2. Driving the launcher
  sc("home.01-remote", "Remote: focus on Rocket Crew, its resume point under it", "home", "default", ALL, tonight),
  sc("home.02-focus-bake", "Right on the d-pad: focus moves to Bake Shop", "home", "default", ["phone", "tv"], () => presses(tonight(), "right")),
  sc("home.03-focus-far", "Further right: the row slides, Hearthisle game night in focus", "home", "default", ["phone", "tv"], () => presses(tonight(), "right", "right", "right", "right", "right")),
  sc("home.04-system-row", "Down: the system row (your turn, game night, who's here, devices)", "home", "default", ["phone", "tv"], () => presses(tonight(), "down")),
  sc("home.05-users-row", "Up: the household's stickers, who's here tonight", "home", "default", ["phone", "tv"], () => presses(tonight(), "up", "right", "right")),
  sc("home.06-browse", "List mode: the phone shows the same row as tiles; the TV follows", "home", "default", ["phone", "tv"], () => ({ ...tonight(), phoneMode: "browse", focus: { zone: "games", games: 1, system: 0, users: 0 } })),
  sc("home.07-detail", "A on Rocket Crew: art, resume point, who's playing, Continue / New", "home", "default", ["phone", "tv"], () => presses(tonight(), "a")),
  sc("home.08-detail-browse", "The same detail on the phone in List mode", "home", "default", ["phone", "tv"], () => ({ ...openGame(tonight(), "bake-shop"), phoneMode: "browse" })),
  sc("home.09-devices", "Phones & iPads on this TV (Ava's battery at 9%)", "home", "default", ["tv"], () => presses(tonight(), "down", "right", "right", "right", "a")),
  sc("home.10-night", "Game night across three homes, its own tile and detail", "game-night", "default", ["tv"], () => openGame(tonight(), "hearthisle")),
  // 3. Who's playing
  sc("tonight.01-who", "Who's playing Rocket Crew? Last crew picked; Juneau's iPad lights up", "tonight", "default", ALL, () => choose(base(), "rocket-crew", "continue")),
  sc("tonight.02-who-ava", "Ava added as helper: her iPad lights up too", "tonight", "success", ALL, () => ava(presses(choose(base(), "rocket-crew", "continue"), "left", "a"))),
  sc("tonight.03-who-browse", "Who's playing, on the phone in List mode", "tonight", "default", ["phone"], () => ({ ...choose(base(), "rocket-crew", "continue"), phoneMode: "browse" })),
  sc("tonight.04-starting", "Start: Rocket Crew opens inside the same stream", "tonight", "success", ALL, () => launch(base(), "rocket-crew", ["dad", "juneau", "ava"])),
  // 4. Swap
  sc("swap.01-playing-rocket", "Rocket Crew mission 6: TV game, phone Captain, Juneau's Fixer", "swap", "default", ALL, () => playing("rocket-crew")),
  sc("swap.01b-ava-helper", "Ava's iPad: one big helper button", "swap", "default", ["ipad"], () => ava(playing("rocket-crew"))),
  sc("swap.02-home", "Home: the TV is back on the launcher, Rocket Crew suspended at mission 6", "swap", "interrupted", ALL, () => goHome(playing("rocket-crew"))),
  sc("swap.03-focus-bake", "Right: Bake Shop, day 4 under it", "swap", "default", ["phone", "tv"], () => presses(goHome(playing("rocket-crew")), "right")),
  sc("swap.04-bake-detail", "A: Bake Shop's page, tonight's crew already on it", "swap", "default", ["phone", "tv"], () => presses(goHome(playing("rocket-crew")), "right", "a")),
  sc("swap.05-cutover", "A on Continue: Bake Shop starts in the same stream; mission 6 saved", "swap", "success", ALL, () => presses(goHome(playing("rocket-crew")), "right", "a", "a")),
  sc("swap.06-bake-playing", "Bake Shop day 4: order reader on the phone, Baker on Juneau's iPad", "swap", "success", ALL, () => playing("bake-shop")),
  sc("swap.06b-ava-bake", "Ava's iPad follows by name: littlest helper", "swap", "success", ["ipad"], () => ava(playing("bake-shop"))),
  // 5. Your turn
  sc("word-duel.01-system", "The Your turn icon on the TV, with a 2", "word-duel", "default", ["phone", "tv"], () => presses(tonight(), "down")),
  sc("word-duel.02-turns", "Two turns on the TV: who, last move, score; never your letters", "word-duel", "default", ["phone", "tv"], () => presses(tonight(), "down", "a")),
  sc("word-duel.03-on-phone", "Playing Nana's game on the phone; the TV only says a turn is happening", "word-duel", "partial", ["phone", "tv"], () => playDuel(presses(tonight(), "down", "a"), "wd-1")),
  sc("word-duel.04-done", "Played: one turn left on the TV", "word-duel", "success", ["phone", "tv"], () => ({ ...presses(tonight(), "down", "a"), duelsDone: ["wd-1"] })),
  // 6. Edge
  sc("failure.01-remote-asleep", "Jonathan's phone sleeps mid-game: the TV says so in a corner", "failure", "interrupted", ["phone", "tv"], () => ({ ...playing("rocket-crew"), dadAsleep: true })),
  sc("failure.02-mom-offer", "Mom's phone offers the remote", "failure", "interrupted", ["phone", "tv"], () => ({ ...goHome(playing("rocket-crew")), dadAsleep: true, viewer: "mom" })),
  sc("failure.03-mom-remote", "Mom has the remote; the TV says whose it is", "failure", "success", ["phone", "tv"], () => ({ ...goHome(playing("rocket-crew")), dadAsleep: true, viewer: "mom", remoteHolder: "mom" })),
  sc("failure.04-cast-dropped", "The cast drops mid-game: the TV is back to its own screen; nothing lost", "failure", "error", ALL, () => ({ ...playing("rocket-crew"), cast: "dropped" })),
  sc("failure.05-recasting", "Cast again: the TV picks up Rocket Crew at mission 6", "failure", "loading", ALL, () => ({ ...playing("rocket-crew"), cast: "recasting" })),
  sc("failure.06-resumed", "Resumed: same mission, same crew, iPads back in", "failure", "success", ALL, () => playing("rocket-crew")),
];
