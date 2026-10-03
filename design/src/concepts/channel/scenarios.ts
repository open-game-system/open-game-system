import type { Scenario } from "../../harness/types";
import { NOW } from "../../world";
import { base, type S } from "./state";
import { SCORE, WORD } from "./duel/boardData";

const cutFrom = (over: Partial<S>): S => base({ phone: "controller", prev: "rocket-crew", next: "bake-shop", ...over });
const nana = (over: Partial<S>): S => base({ phone: "duel-board", duelOpen: "wd-1", ...over });
const played = (): S => {
  const s = nana({ sent: true, placed: ["O0", "N1", "E2"] });
  return {
    ...s,
    duels: s.duels.map((g) => (g.id === "wd-1" ? { ...g, status: "waiting", you: g.you + SCORE, lastMove: `You played ${WORD} for ${SCORE}`, lastWord: WORD, updatedAt: NOW.toISOString() } : g)),
  };
};

export const scenarios: Scenario<S>[] = [
  { id: "home.01-on-now", label: "Fri 7:10 · Rocket Crew on now", flow: "home", state: "default", devices: ["phone", "tv", "ipad"], build: () => base() },
  { id: "home.02-continuity", label: "Channel on air, nothing playing yet (TV continuity)", flow: "home", state: "default", devices: ["phone", "tv", "ipad"], build: () => base({ tv: "continuity" }) },
  { id: "home.03-ava-idle", label: "Ava's iPad: paired, following tonight", flow: "home", state: "default", devices: ["ipad"], build: () => base({ tv: "continuity", ipad: "ava" }) },
  { id: "home.04-later", label: "Later: the schedule layer", flow: "home", state: "default", devices: ["phone"], build: () => base({ phone: "schedule" }) },
  { id: "home.05-first-run", label: "First time: off air", flow: "home", state: "empty", devices: ["phone"], build: () => base({ phone: "first-run", tv: "off" }) },

  { id: "swap.01-mid-game", label: "Mid Rocket Crew: Dad captains, Juneau fixes", flow: "swap", state: "default", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "controller" }) },
  { id: "swap.02-ava-mid-game", label: "Mid Rocket Crew: Ava's big star", flow: "swap", state: "default", devices: ["ipad"], build: () => base({ phone: "controller", ipad: "ava" }) },
  { id: "swap.03-running-order", label: "Dad opens the running order", flow: "swap", state: "default", devices: ["phone", "tv"], build: () => base({ phone: "director" }) },
  { id: "swap.04-saving", label: "Cut: Rocket Crew saving (squeezeback)", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => cutFrom({ cut: "saving" }) },
  { id: "swap.05-ident", label: "Cut: the channel ident", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => cutFrom({ cut: "ident" }) },
  { id: "swap.06-following", label: "Cut: iPads following", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => cutFrom({ cut: "following", onAir: "bake-shop" }) },
  { id: "swap.07-on-air", label: "Bake Shop on air, everyone in their seat", flow: "swap", state: "success", devices: ["phone", "tv", "ipad"], build: () => cutFrom({ onAir: "bake-shop", lowerThird: "intro", undoOpen: true }) },
  { id: "swap.08-ava-on-air", label: "Ava's iPad: sprinkles", flow: "swap", state: "success", devices: ["ipad"], build: () => cutFrom({ onAir: "bake-shop", ipad: "ava", undoOpen: true }) },
  { id: "swap.09-ava-asleep-cut", label: "Ava's iPad asleep at 9% during the cut", flow: "swap", state: "interrupted", devices: ["phone", "ipad"], build: () => cutFrom({ cut: "following", onAir: "bake-shop", ipad: "ava", avaAsleep: true }) },
  { id: "swap.10-ava-asleep", label: "Bake Shop on, Ava's seat saved", flow: "swap", state: "interrupted", devices: ["phone", "tv", "ipad"], build: () => cutFrom({ onAir: "bake-shop", ipad: "ava", avaAsleep: true, avaNotice: true, lowerThird: "intro", undoOpen: true }) },
  { id: "swap.11-back", label: "Undo: back to Rocket Crew mission 6", flow: "swap", state: "undone", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "controller", prev: "bake-shop", next: "rocket-crew", lowerThird: "back" }) },

  { id: "word-duel.01-list", label: "Your turn: open games", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "duel-list" }) },
  { id: "word-duel.02-nana", label: "Nana's game", flow: "word-duel", state: "default", devices: ["phone"], build: () => nana({}) },
  { id: "word-duel.03-placing", label: "Laying tiles", flow: "word-duel", state: "partial", devices: ["phone"], build: () => nana({ placed: ["O0", "N1"] }) },
  { id: "word-duel.04-ready", label: "TONE ready to play", flow: "word-duel", state: "partial", devices: ["phone"], build: () => nana({ placed: ["O0", "N1", "E2"] }) },
  { id: "word-duel.05-sent", label: "Sent to Nana", flow: "word-duel", state: "success", devices: ["phone"], build: played },
  { id: "word-duel.06-list-after", label: "Back to the list: Nana is waiting", flow: "word-duel", state: "success", devices: ["phone"], build: () => ({ ...played(), phone: "duel-list" }) },
  { id: "word-duel.07-new", label: "New game", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "duel-new" }) },
];
