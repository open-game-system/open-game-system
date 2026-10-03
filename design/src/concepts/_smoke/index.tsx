// Rig smoke test and fault fixture: not a design. Excluded from rounds (ids starting with "_").
// Each "fault" below must be caught by scripts/prove-rig.ts; if one stops failing, the rig is blind.
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import { GAMES } from "../../world";

interface S { gameId: string }

function Surface({ device, store, seat }: SurfaceProps<S>) {
  const s = useStore(store);
  const game = GAMES.find((g) => g.id === s.gameId);
  if (device === "tv")
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <img src={game?.art.tv} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        {/* fault: TV text under 24 px */}
        <span style={{ position: "absolute", left: 40, top: 40, font: "16px system-ui", color: "#fff", background: "#000" }}>fault-tv-small</span>
      </div>
    );
  if (device === "ipad")
    return (
      <div style={{ background: "#222", height: "100%", color: "#fff", font: "40px system-ui" }} data-seat-shown={seat}>
        {/* fault: words on a kid screen */}
        <p style={{ margin: 0, padding: 40 }}>fault-kid-words</p>
      </div>
    );
  return (
    <div style={{ padding: 24, font: "17px system-ui", background: "#fff", color: "#111", height: "100%" }}>
      <p>{game?.name}</p>
      <button data-bot="swap" onClick={() => store.update((x) => ({ gameId: x.gameId === "rocket-crew" ? "bake-shop" : "rocket-crew" }))} style={{ padding: 16 }}>
        Swap
      </button>
      {/* fault: tap target under 44 pt */}
      <button data-bot="tiny" aria-label="fault-tiny" style={{ width: 20, height: 20 }} />
      {/* fault: low-contrast text */}
      <p style={{ color: "#d8d8d8" }}>fault-low-contrast</p>
      {/* fault: clipped text */}
      <div style={{ width: 60, overflow: "hidden", whiteSpace: "nowrap" }}>fault-clipped-text-that-is-long</div>
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "_smoke",
  name: "Rig smoke + faults",
  brief: "Proves the shooter and flow bot catch every fault they claim to.",
  Surface,
  scenarios: [
    { id: "home.01-rocket", label: "Rocket Crew on", flow: "home", state: "default", devices: ["phone", "ipad", "tv"], build: () => ({ gameId: "rocket-crew" }) },
    { id: "swap.01-bake", label: "Bake Shop on", flow: "swap", state: "success", devices: ["phone", "tv"], build: () => ({ gameId: "bake-shop" }) },
  ],
  flows: [{ id: "swap", flow: "swap", label: "Swap games", start: "home.01-rocket", steps: [{ device: "phone", bot: "swap", mark: "Swap to Bake Shop" }] }],
});
