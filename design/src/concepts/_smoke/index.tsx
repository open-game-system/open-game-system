// Rig smoke test: not a design. Excluded from rounds (ids starting with "_").
import { defineConcept, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import { GAMES } from "../../world";

interface S { gameId: string }

function Surface({ device, store }: SurfaceProps<S>) {
  const s = useStore(store);
  const game = GAMES.find((g) => g.id === s.gameId);
  if (device === "tv") return <img src={game?.art.tv} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />;
  if (device === "ipad") return <div style={{ background: "#222", height: "100%" }} />;
  return (
    <div style={{ padding: 24, font: "17px system-ui" }}>
      <p>{game?.name}</p>
      <button data-bot="swap" onClick={() => store.update((x) => ({ gameId: x.gameId === "rocket-crew" ? "bake-shop" : "rocket-crew" }))} style={{ padding: 16 }}>
        Swap
      </button>
      <button data-bot="tiny" style={{ width: 20, height: 20 }} />
    </div>
  );
}

export const concept = defineConcept<S>({
  id: "_smoke",
  name: "Rig smoke",
  brief: "Proves the shooter and flow bot.",
  Surface,
  scenarios: [
    { id: "home.01-rocket", label: "Rocket Crew on", flow: "home", state: "default", devices: ["phone", "ipad", "tv"], build: () => ({ gameId: "rocket-crew" }) },
    { id: "swap.01-bake", label: "Bake Shop on", flow: "swap", state: "success", devices: ["phone", "tv"], build: () => ({ gameId: "bake-shop" }) },
  ],
  flows: [{ id: "swap", flow: "swap", label: "Swap games", start: "home.01-rocket", steps: [{ device: "phone", bot: "swap", mark: "Swap to Bake Shop" }, { device: "phone", bot: "nope" }] }],
});
