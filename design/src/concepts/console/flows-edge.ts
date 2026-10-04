import type { Flow } from "../../harness/types";

/** Bot flows owned by the edge owner (flow "failure"). Each step is a real tap. */
export const edgeFlows: Flow[] = [
  {
    id: "stream-crash",
    flow: "failure",
    label: "The cloud picture freezes mid mission 6; it comes back at mission 6 (0 kid taps, 1 phone tap)",
    start: "failure.00-mid-mission",
    steps: [
      {
        device: "phone",
        bot: "edge-restart",
        mark: "The TV picture froze. Kids' iPads wait with their characters; the phone offers one action (OGS would also restart it by itself)",
        wait: 5400,
      },
    ],
  },
  {
    id: "remote-handoff",
    flow: "failure",
    label: "Jonathan's phone dies mid mission 6; Mom's phone picks up the remote, nothing restarts",
    start: "failure.09-remote-armed",
    steps: [
      { device: "ipad", seat: "juneau", bot: "cell-star", mark: "Jonathan's phone goes dark. Juneau keeps fixing the rocket: the game never stopped", wait: 900 },
      { device: "ipad", seat: "ava", bot: "helper-star", mark: "Ava keeps helping", wait: 900 },
      { device: "phone", bot: "edge-push-remote", mark: "Mom's phone: a push. Rocket Crew is still going at mission 6", wait: 1600 },
      { device: "phone", bot: "edge-take-remote", mark: "Take the remote: her phone becomes the remote and the captain seat", wait: 1800 },
    ],
  },
  {
    id: "save-conflict",
    flow: "failure",
    label: "Two phones saved Bake Shop day 4 differently: pick one, the other is kept, change your mind",
    start: "failure.30-save-conflict",
    steps: [
      { device: "phone", bot: "edge-save-tuesday", mark: "Each version says what it holds. Pick Mom's", wait: 1000 },
      { device: "phone", bot: "edge-save-tonight", mark: "No, the living room's: Mrs. Bear was already served", wait: 1000 },
      { device: "phone", bot: "edge-save-keep", mark: "Keep it; Mom's day 4 is kept in Saves", wait: 3000 },
    ],
  },
  {
    id: "home-drop",
    flow: "failure",
    label: "The Okafors drop at Hearthisle turn 15; the host holds the board; they come back",
    start: "failure.40-okafors-drop",
    steps: [{ device: "phone", bot: "edge-night-wait", mark: "We're hosting, so we decide: hold the board. Every home sees it waiting", wait: 2300 }],
  },
];
