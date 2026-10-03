// Tonight's couch session on the grown-up phone: the session bar (OGS) over the game's own view.
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { StatusBar } from "../ui/Chrome";
import { PHONE_VIEW } from "../games";
import { SessionBar } from "./SessionBar";
import { SwitchSheet } from "./SwitchSheet";
import { Handoff } from "./Handoff";

export function CouchScreen({ s, store }: { s: S; store: Store<S> }) {
  const c = s.couch;
  const swapping = c.phase === "saving" || c.phase === "cutover" || c.phase === "following";
  const view = c.gameId ? PHONE_VIEW[c.gameId] : undefined;
  return (
    <div className="pf-phone">
      <StatusBar />
      <SessionBar s={s} store={store} />
      <div className="pf-gameframe" key={`${c.gameId}-${swapping}`}>
        {swapping ? <Handoff s={s} store={store} /> : view ? view({ dimmed: c.phase === "choosing" }) : null}
      </div>
      {c.phase === "choosing" && <SwitchSheet s={s} store={store} />}
    </div>
  );
}
