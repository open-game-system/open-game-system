// "Switch the TV to…": one tap on a game swaps it. The row already shows the resume point and
// who sits where, so there is nothing left to confirm; undo is offered afterwards instead.
import type { Store } from "../../../harness/store";
import { couchGames, gameById, resumePoint, saveOf, seatsFor } from "../household";
import { Chevron } from "../ui/Icons";
import { currentGame, startSwitch, type S } from "../state";

export function Switcher({ s, store }: { s: S; store: Store<S> }) {
  const cur = currentGame(s);
  const games = couchGames()
    .filter((g) => g.id !== cur)
    .sort((a, b) => rank(a.id) - rank(b.id));
  const pick = (id: string) =>
    store.update((x) => (currentGame(x) ? startSwitch(x, id) : { ...x, sheet: null, phone: "game", tonight: { kind: "playing", gameId: id } }));
  return (
    <div className="pl-sheet-wrap">
      <button className="pl-scrim" aria-label="Close" data-bot="close-sheet" onClick={() => store.update((x) => ({ ...x, sheet: null }))} />
      <div className="pl-sheet" role="dialog" aria-label="Switch the TV">
        <span className="pl-grabber" />
        <h2 className="pl-h2 pl-sheet-title">Switch the TV to…</h2>
        {cur && (
          <p className="pl-sheet-note">
            {gameById(cur).name} saves at {resumePoint(cur).toLowerCase()}. Juneau's and Ava's iPads follow on their own.
          </p>
        )}
        <ul className="pl-pick">
          {games.map((g) => {
            const inst = saveOf(g.id);
            const resume = inst?.status === "suspended";
            return (
              <li key={g.id}>
                <button className="pl-pick-row" data-bot={`pick-${g.id}`} onClick={() => pick(g.id)}>
                  <img src={g.art.tv} alt="" />
                  <span className="pl-pick-text">
                    <b>{g.name}</b>
                    <span className={resume ? "pl-pick-resume" : "pl-pick-sub"}>
                      {resume ? `Pick up ${inst.title.split(" · ")[0]?.toLowerCase() ?? ""}` : inst?.detail.split(" · ")[0] ?? g.tagline}
                    </span>
                    <span className="pl-pick-seats">
                      {seatsFor(g)
                        .map((x) => `${x.person.name} ${x.role.toLowerCase()}`)
                        .join(" · ")}
                    </span>
                  </span>
                  <Chevron size={18} />
                </button>
              </li>
            );
          })}
        </ul>
        <button className="pl-btn pl-btn--secondary pl-wide" data-bot="keep-playing" onClick={() => store.update((x) => ({ ...x, sheet: null }))}>
          <span> {cur ? `Keep playing ${gameById(cur).name}` : "Not yet"}</span>
        </button>
      </div>
    </div>
  );
}

const rank = (id: string) => (saveOf(id)?.status === "suspended" ? 0 : 1);
