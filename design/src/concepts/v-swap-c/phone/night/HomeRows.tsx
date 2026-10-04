// The homes of a night as rows: seat, where they play, and their state in the shared vocabulary.
import type { Store } from "../../../../harness/store";
import { household, removeHome, screenWords, seatWords, US, type Night, type NightHome } from "../../nights";
import { Crest } from "../../ui/Sticker";
import type { S } from "../../state";
import { st, type Status } from "../../status";
import { Chip } from "../../ui/Chip";
import { Close, PhoneIcon, TvIcon } from "../../ui/Icons";

function stateOf(h: NightHome, n: Night): Status {
  if (h.reply === "invited") return st("invited", "Invited");
  if (h.reply === "declined") return st("closed", "Can't make it");
  if (n.status === "live" && n.turnOf === h.householdId) return h.householdId === US ? st("yours", "Your roll") : st("theirs", "Rolling");
  if (!h.back) return st("paused", "Not back yet");
  return st("done", h.householdId === US ? "Host" : "In");
}

export function HomeRows({ n, store, mode }: { n: Night; store: Store<S>; mode: "status" | "seat" | "screen" }) {
  return (
    <ul className="cx-homes">
      {n.homes.map((h) => (
        <li key={h.householdId} className="cx-homes__row">
          <Crest household={household(h.householdId)} size={44} shared dim={h.reply === "declined"} />
          <span className="cx-homes__text">
            <b>{h.name}</b>
            <span>
              {mode === "screen" ? (
                <>
                  {h.screen === "tv" ? <TvIcon size={15} /> : <PhoneIcon size={15} />} {screenWords(h)}
                </>
              ) : mode === "seat" ? (
                `${h.colorName[0]?.toUpperCase() ?? ""}${h.colorName.slice(1)} seat · ${seatWords(h)}`
              ) : (
                `${h.colorName[0]?.toUpperCase() ?? ""}${h.colorName.slice(1)} · ${screenWords(h)}`
              )}
            </span>
          </span>
          {mode === "status" && <Chip status={stateOf(h, n)} />}
          {mode !== "status" && h.householdId !== US && (
            <button className="cx-iconbtn" data-bot={`remove-${h.householdId}`} aria-label={`Remove ${h.name}`} onClick={() => store.update((x) => ({ ...x, nights: removeHome(x.nights, h.householdId) }))}>
              <Close size={18} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
