// Tier 0: the manifest. A copy-pasteable file for a real game (Peekaboo Garden).
import { C, CodeCard, L } from "../Code";
import type { DevPage } from "../pages";
import { Tile } from "../Payoff";
import { MANIFEST_PATH, PEEK_MANIFEST } from "../samples";
import { TierChip } from "../Shell";

const FIELDS: [string, string, string][] = [
  ["appId", "string", "Your id. Keys your saves and instances."],
  ["name, icon", "string, URL", "The library tile. Icon is a 512 px PNG."],
  ["shape", "couch | live | async", "Which shelf: Together on the TV, Game night, Duels."],
  ["minutes", "[min, max]", "One sitting, shown on the tile."],
  ["startUrl", "https URL", "Opens on every phone and iPad in the room."],
  ["tvUrl", "https URL", "Cast to the TV. 1920 × 1080, nobody touches it."],
  ["roles[].audience", "grownup | kid | little", "Who gets which seat. Kids and littles get your no-words screen."],
];

export function Manifest({ go }: { go: (p: DevPage) => void }) {
  return (
    <div className="dv-split">
      <article className="dv-doc">
        <p className="dv-kicker">
          <TierChip tier={0} size="sm" /> Plays on the TV
        </p>
        <h1 className="dv-h1">Add a manifest</h1>
        <p className="dv-lede">
          <L>One file on your domain at <C>{MANIFEST_PATH}</C>,</L>
          <L>or pasted into the Console. That is the whole integration.</L>
        </p>

        <table className="dv-fields">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">What OGS does with it</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(([f, t, d]) => (
              <tr key={f}>
                <td>
                  <C>{f}</C>
                  <span className="dv-fields__type">{t}</span>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="dv-h2">What the family sees</h2>
        <div className="dv-payoff">
          <div className="dv-payoff__vis">
            <Tile gameId="peekaboo-garden" tier={0} />
          </div>
          <p>
            <b className="dv-l">Together on the TV shelf</b>
            <L>Any phone casts it. Starts fresh.</L>
            <button className="dv-link" data-bot="next-identity" onClick={() => go("identity")}>
              Keep their place with Tier 1 →
            </button>
          </p>
        </div>
      </article>

      <aside className="dv-codecol">
        <CodeCard
          title={MANIFEST_PATH}
          code={PEEK_MANIFEST}
          lang="json"
          badge="Game fields new"
          numbers
          foot={
            <>
              <span>
                <L><C>appId</C>, <C>name</C> and <C>apiVersion</C></L>
                <L>are the spec's domain file today. The rest is new.</L>
              </span>
              <button className="dv-btn dv-btn--light" data-bot="paste-console" onClick={() => go("console-error")}>
                Paste into Console
              </button>
            </>
          }
        />
        <ol className="dv-then">
          <li>
            <span>
              <b>Paste it into the Console.</b> It checks every field as you type.
            </span>
          </li>
          <li>
            <span>
              <b>Test on your TV.</b> Cast a private preview from your own phone.
            </span>
          </li>
          <li>
            <span>
              <b>Publish.</b> Families who open your link can add it to their library.
            </span>
          </li>
        </ol>
      </aside>
    </div>
  );
}
