// Tier 1: who is playing (a signed token on the start URL) and OGS-hosted saves.
import { useState } from "react";
import { C, CodeCard, CodeLines, L } from "../Code";
import type { DevPage } from "../pages";
import { JoinByName, ResumeRow } from "../Payoff";
import { READ_TOKEN, SAVE_GET, SAVE_PUT } from "../samples";
import { TierChip } from "../Shell";

const CLAIMS: [string, string, string][] = [
  ["household", "hh-mumm", "Keys the save slot."],
  ["person, name", "juneau, Juneau", "Who holds this device."],
  ["band", "kid", "grownup, kid or little."],
  ["role", "baker", "The seat OGS picked."],
  ["device, room", "dev-juneau-ipad", "Which screen, sitting."],
];

const VERBS: ("GET" | "PUT")[] = ["GET", "PUT"];

export function Identity({ go }: { go: (p: DevPage) => void }) {
  const [verb, setVerb] = useState<"GET" | "PUT">("PUT");
  return (
    <div className="dv-split">
      <article className="dv-doc">
        <p className="dv-kicker">
          <TierChip tier={1} size="sm" /> Keeps your place
        </p>
        <h1 className="dv-h1">Identity and saves</h1>
        <p className="dv-lede">
          <L>OGS adds <C>?ogs=</C> to your <C>startUrl</C>:</L>
          <L>a signed token for household, person and device. It also unlocks one save per household × game.</L>
        </p>

        <h2 className="dv-h2">
          <span className="dv-step">1</span> Read who is playing
        </h2>
        <table className="dv-fields dv-fields--claims">
          <tbody>
            {CLAIMS.map(([k, v, d]) => (
              <tr key={k}>
                <td>
                  <C>{k}</C>
                </td>
                <td className="dv-fields__val">{v}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="dv-h2">
          <span className="dv-step">2</span> Load and save
        </h2>
        <p className="dv-p">
          <L>Put a one-line <C>resume</C> in every save; the library shows it.</L>
          <L><C>If-Match</C> stops two phones overwriting each other.</L>
          <L>409 means reload. 64 KB per slot.</L>
        </p>

        <div className="dv-payoff dv-payoff--row dv-payoff--t1">
          <ResumeRow gameId="bake-shop" point="Day 4 · 3 of 5 orders baked" when="paused Tuesday" />
          <JoinByName gameId="bake-shop" />
        </div>
        <button className="dv-link" data-bot="next-instances" onClick={() => go("instances")}>
          Put it live on Home with Tier 2 →
        </button>
      </article>

      <aside className="dv-codecol">
        <CodeCard title="Read the token" code={READ_TOKEN} lang="ts" badge="/me is new" />
        <figure className="dv-code">
          <figcaption className="dv-code__head">
            <span className="dv-tabs" role="tablist" aria-label="Save requests">
              {VERBS.map((v) => (
                <button key={v} role="tab" aria-selected={verb === v} className={verb === v ? "is-on" : ""} data-bot={`save-${v}`} onClick={() => setVerb(v)}>
                  {v === "GET" ? "Load" : "Save"}
                </button>
              ))}
            </span>
            <span className="dv-new">Saves are new</span>
            <button className="dv-copy" aria-label="Copy save request">
              Copy
            </button>
          </figcaption>
          <CodeLines code={verb === "GET" ? SAVE_GET : SAVE_PUT} lang="http" />
        </figure>
      </aside>
    </div>
  );
}
