// What other homes see of us, said at the moment we decide: the household name and seat colour,
// never the kids' names or pictures unless we choose. One switch, reversible any time.
import type { Store } from "../../../../harness/store";
import { HOME } from "../../../../world";
import type { NightHome } from "../../nights";
import type { S } from "../../state";
import { Eye } from "../../ui/Icons";

export function Trust({ s, store, us }: { s: S; store: Store<S>; us: NightHome | undefined }) {
  const kids = HOME.people.filter((p) => p.band !== "grownup").map((p) => p.name);
  const seen = s.nights.kidNames ? `The Mumms (Jonathan, Juneau) · ${us?.colorName ?? "blue"} seat` : `The Mumms · ${us?.colorName ?? "blue"} seat`;
  return (
    <section className="cx-trust" aria-label="What other homes see">
      <h3>
        <Eye size={18} /> What the other homes see of us
      </h3>
      <p className="cx-trust__seen">{seen}</p>
      <p>{s.nights.kidNames ? `Juneau's name is shown. ${kids[1] ?? "Ava"}'s isn't. Pictures never leave this home.` : `${kids.join(" and ")}'s names and pictures stay in this home. Other homes see only their own hands.`}</p>
      <label className="cx-switchrow">
        <span>Show Juneau's name</span>
        <input type="checkbox" role="switch" data-bot="kid-names" checked={s.nights.kidNames} onChange={() => store.update((x) => ({ ...x, nights: { ...x.nights, kidNames: !x.nights.kidNames } }))} />
      </label>
      <p className="cx-trust__who">Only homes you invite can join. Remove a home any time; its seat leaves the board.</p>
    </section>
  );
}
