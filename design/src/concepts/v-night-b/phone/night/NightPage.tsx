// A game night's page on the phone. One page, four moments: the night itself (detail), and the
// three setup steps for a new one (invite → seats → where each home plays).
import type { Store } from "../../../../harness/store";
import { nightOpen } from "../../nights";
import { goHome, type S } from "../../state";
import { StatusBar } from "../../ui/Brand";
import { Chevron } from "../../ui/Icons";
import { InvitePreview } from "./InvitePreview";
import { NightDetail } from "./NightDetail";
import { NightInvite } from "./NightInvite";
import { NightSeats, NightWhere } from "./NightSetup";

export function NightPage({ s, store }: { s: S; store: Store<S> }) {
  const n = nightOpen(s.nights);
  const step = s.nights.step;
  return (
    <div className="cx-phone cx-nightpage iv-room">
      <StatusBar dark />
      <div className="cx-topbar">
        <button className="cx-back" data-bot="night-back" onClick={() => store.update((x) => ({ ...goHome(x), nights: { ...x.nights, peek: true } }))}>
          <Chevron size={20} dir="left" /> Home
        </button>
        {step !== "detail" && <span className="cx-topbar__step">{step === "invite" ? "The card" : step === "seats" ? "The table" : "The screens"} · {step === "invite" ? 1 : step === "seats" ? 2 : 3} of 3</span>}
      </div>
      <div className="cx-scroll" inert={s.nights.preview}>
        {step === "detail" && n ? <NightDetail n={n} s={s} store={store} /> : step === "seats" && n ? <NightSeats n={n} s={s} store={store} /> : step === "where" && n ? <NightWhere n={n} store={store} /> : <NightInvite n={n} s={s} store={store} />}
      </div>
      {s.nights.preview && n && <InvitePreview n={n} s={s} store={store} />}
    </div>
  );
}
