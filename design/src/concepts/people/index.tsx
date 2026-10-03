// Concept E, "People First": the app is organised around your people, like a messages app.
// Us (tonight's couch), Nana, Mom, Friday game night… each thread holds the games you have going
// with them; your move = unread. The library is where you start something new with someone.
import { defineConcept, type Scenario, type SurfaceProps } from "../../harness/types";
import css from "./concept.css?raw";
import { base, couch, playMove, type S } from "./state";
import { PhoneSurface } from "./phone/PhoneSurface";
import { TvSurface } from "./tv/TvSurface";
import { IpadSurface } from "./ipad/IpadSurface";

function Surface({ device, store, shot }: SurfaceProps<S>) {
  if (device === "tv") return <TvSurface store={store} />;
  if (device === "ipad") return <IpadSurface store={store} />;
  return (
    <div className="pf" style={{ height: "100%" }}>
      <PhoneSurface store={store} shot={shot} />
    </div>
  );
}

const ALL: Scenario<S>["devices"] = ["phone", "tv", "ipad"];
const sc = (id: string, label: string, state: Scenario<S>["state"], devices: Scenario<S>["devices"], build: () => S): Scenario<S> => ({
  id,
  label,
  flow: id.startsWith("home") ? "home" : id.startsWith("swap") ? "swap" : "word-duel",
  state,
  devices,
  build,
});

const toBake = { gameId: "bake-shop", left: { gameId: "rocket-crew", savedAt: "Mission 6" } };
const atCouch: Pick<S, "phone"> = { phone: { kind: "couch" } };

const scenarios: Scenario<S>[] = [
  // ---- home: Friday 7:10 pm
  sc("home.01-people", "Phone home: People (threads), Friday 7:10", "default", ["phone"], () => base()),
  sc("home.02-your-move", "Phone home filtered to Your move", "partial", ["phone"], () => base({ phone: { kind: "people", filter: "yourMove" } })),
  sc("home.03-tv-ambient", "TV: cast, nothing running (ambient, 3 m)", "default", ["tv"], () => base({ couch: couch({ gameId: null, phase: "idle", arrived: [] }) })),
  sc("home.04-ipad-idle", "Juneau's iPad: paired, following tonight", "default", ["ipad"], () => base({ couch: couch({ gameId: null, phase: "idle", arrived: [] }) })),
  sc("home.05-first-run", "Phone home, first time: nobody yet", "empty", ["phone"], () => base({ phone: { kind: "people-empty" }, firstRun: true })),
  sc("home.06-us-thread", "The household's thread: every couch game and where it stands", "default", ["phone"], () => base({ phone: { kind: "us" } })),
  sc("home.07-game-night", "Group thread: Friday game night across three homes", "default", ["phone"], () => base({ phone: { kind: "game-night" } })),
  sc("home.08-library", "Games tab: start something with someone", "default", ["phone"], () => base({ phone: { kind: "library" } })),
  sc("home.09-household", "Household tab: people and devices", "default", ["phone"], () => base({ phone: { kind: "household" } })),

  // ---- swap: Rocket Crew mission 6 → Bake Shop day 4
  sc("swap.01-mid-game", "Mid Rocket Crew: Captain on phone, Fixer on iPad, TV full-bleed", "default", [...ALL], () => base(atCouch)),
  sc("swap.02-choose", "Switch: next on the couch (resume points, seats prefilled)", "default", ["phone"], () => base({ ...atCouch, couch: couch({ phase: "choosing" }) })),
  sc("swap.03-saving", "Saving mission 6 (loading) on every device", "loading", [...ALL], () => base({ ...atCouch, couch: couch({ ...toBake, phase: "saving", arrived: [] }) })),
  sc("swap.04-tv-cutover", "TV cut-over inside the same cast", "loading", [...ALL], () => base({ ...atCouch, couch: couch({ ...toBake, phase: "cutover", arrived: [] }) })),
  sc("swap.05-kids-follow", "Kid iPads following by name (Juneau's on the way)", "partial", [...ALL], () => base({ ...atCouch, couch: couch({ ...toBake, phase: "following", arrived: [] }) })),
  sc("swap.06-loaded", "Bake Shop day 4, everyone in their seat", "success", [...ALL], () => base({ ...atCouch, couch: couch({ ...toBake, phase: "playing", arrived: ["juneau", "ava"] }) })),
  sc("swap.07-ava-following", "Ava's iPad following (the littlest helper)", "partial", ["ipad"], () => base({ ipadOwner: "ava", couch: couch({ ...toBake, phase: "following", arrived: ["juneau"] }) })),
  sc("swap.08-ava-asleep", "Ava's iPad asleep at 9%: didn't follow, seat saved", "interrupted", [...ALL], () => base({ ...atCouch, ipadOwner: "ava", couch: couch({ ...toBake, phase: "playing", arrived: ["juneau"], avaAsleep: true }) })),
  sc("swap.09-ava-chime", "Chime Ava's iPad so someone finds it", "interrupted", ["phone", "ipad"], () => base({ ...atCouch, ipadOwner: "ava", couch: couch({ ...toBake, phase: "playing", arrived: ["juneau"], avaAsleep: true, ringing: true }) })),
  sc("swap.10-ava-caught-up", "Ava opened it: she's in as Littlest helper", "success", ["ipad", "phone"], () => base({ ...atCouch, ipadOwner: "ava", couch: couch({ ...toBake, phase: "playing", arrived: ["juneau", "ava"], frosting: "strawberry" }) })),
  sc("swap.11-undo", "Back to Rocket Crew: mission 6 resumes", "undone", [...ALL], () => base({ ...atCouch, couch: couch({ gameId: "rocket-crew", phase: "playing", left: { gameId: "bake-shop", savedAt: "Day 4" } }) })),
  sc("swap.12-baking", "Juneau frosts the first cupcake", "success", ["ipad", "tv"], () => base({ ...atCouch, couch: couch({ ...toBake, phase: "playing", frosting: "mint", pokes: 1 }) })),

  // ---- word duel
  sc("word-duel.00-push", "A push lands: Nana played QUILT, your move", "default", ["phone"], () => base({ phone: { kind: "people", filter: "all", push: true } })),
  sc("word-duel.01-list", "Word Duel: two your move, three waiting, finished, expired", "default", ["phone"], () => base({ phone: { kind: "duels" } })),
  sc("word-duel.02-nana", "Nana's game: QUILT for 34, your move", "default", ["phone"], () => base({ phone: { kind: "duel", duelId: "wd-1", from: "duels" } })),
  sc("word-duel.03-placing", "Placing HAZE on the L of QUILT", "partial", ["phone"], () => base({ phone: { kind: "duel", duelId: "wd-1", from: "duels" }, placed: [0, 1, 2, 3] })),
  sc("word-duel.04-sent", "Sent: HAZEL for 32, next your move with Mom", "success", ["phone"], () => {
    return playMove("wd-1")(base({ phone: { kind: "duel", duelId: "wd-1", from: "duels" } }));
  }),
  sc("word-duel.05-list-after", "Back to the list: Nana moved to Their move", "success", ["phone"], () => {
    return playMove("wd-1")(base({ phone: { kind: "duels" } }));
  }),
];

export const concept = defineConcept<S>({
  id: "people",
  name: "E · People First",
  brief: "Organised around your people like a messages app: Us on the couch, Nana, Mom, Friday game night. Your move = unread. Kids exist only inside their own household.",
  css,
  Surface,
  scenarios,
  flows: [
    {
      id: "swap",
      flow: "swap",
      label: "Rocket Crew mission 6 → Bake Shop day 4, every device follows",
      start: "swap.01-mid-game",
      steps: [
        { device: "phone", bot: "switch", mark: "Dad taps Switch in the couch bar", wait: 1600 },
        { device: "phone", bot: "pick-bake-shop", mark: "Picks Bake Shop: resumes Day 4, seats prefilled. Rocket Crew saves, TV cuts over, iPads follow", wait: 7200 },
        { device: "ipad", bot: "frost-strawberry", mark: "Juneau's already baking: no scan, no role pick", wait: 1800 },
      ],
    },
    {
      id: "word-duel",
      flow: "word-duel",
      label: "Word Duel: your move with Nana, then back to the list",
      start: "word-duel.01-list",
      steps: [
        { device: "phone", bot: "duel-nana", mark: "Open Nana's game (your move)" },
        { device: "phone", bot: "tile-0", mark: "Tap H", wait: 600 },
        { device: "phone", bot: "tile-1", mark: "Tap A", wait: 600 },
        { device: "phone", bot: "tile-2", mark: "Tap Z", wait: 600 },
        { device: "phone", bot: "tile-3", mark: "Tap E: HAZEL on the L of QUILT", wait: 1000 },
        { device: "phone", bot: "play", mark: "Play HAZEL for 32", wait: 1800 },
        { device: "phone", bot: "back", mark: "Back: Nana's game moved to Their move", wait: 2000 },
      ],
    },
  ],
});
