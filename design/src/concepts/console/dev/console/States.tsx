// The Console's in-between states: reading a manifest from a domain (loading), a TV test that
// dropped (interrupted), and a game taken down (undone), each saying what happens to families.
import { HOUSEHOLDS, gameById } from "../../../../world";
import { GameArt } from "../../ui/GameArt";
import { Check } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";
import { C, L } from "../Code";
import type { DevPage } from "../pages";
import { PEEK_MANIFEST, PEEK_ORIGIN } from "../samples";
import { ConsoleHead, Editor, Previews, TvButton, Warn } from "./parts";

type Go = (p: DevPage) => void;

type Progress = "done" | "now" | "next";

const READING: { state: Progress; label: string; detail: string }[] = [
  { state: "done", label: "Fetched the manifest", detail: `200 · 1.2 KB · 140 ms` },
  { state: "done", label: "JSON parsed", detail: "13 fields, apiVersion v1" },
  { state: "now", label: "Opening your tvUrl in a cloud browser", detail: "first frame… 2.1 s" },
  { state: "next", label: "Icon is a 512 px PNG", detail: "after the first frame" },
  { state: "next", label: "Every role has an audience", detail: "grownup · kid · little" },
];

function Dot({ state }: { state: Progress }) {
  if (state === "done") return <Check size={16} />;
  return <span className={`dc-prog__dot dc-prog__dot--${state}`} aria-hidden />;
}

/** Loading: the manifest is being read from the developer's domain and checked. */
export function Reading({ go }: { go: Go }) {
  return (
    <div className="dc-page">
      <ConsoleHead crumb="Add a game" title="Peekaboo Garden" step={0} />
      <div className="dc-work">
        <div className="dc-left">
          <Editor
            text={PEEK_MANIFEST}
            issues={[]}
            status={
              <span className="dc-pill dc-pill--busy">
                <span className="dc-spin" aria-hidden /> Checking
              </span>
            }
          />
          <p className="dc-leftnote">
            <span>Read from </span>
            <C>{new URL(PEEK_ORIGIN).host}</C>
            <span> at 7:09 pm.</span>
          </p>
        </div>
        <div className="dc-side">
          <section className="dc-panel" aria-label="Checking" aria-busy="true">
            <h2 className="dc-panel__h dc-panel__h--busy">
              <span className="dc-spin" aria-hidden /> Checking your manifest · 2 of 5
            </h2>
            <ol className="dc-prog">
              {READING.map((r) => (
                <li key={r.label} className={`is-${r.state}`}>
                  <Dot state={r.state} />
                  <b>{r.label}</b>
                  <span>{r.detail}</span>
                </li>
              ))}
            </ol>
            <p className="dc-prog__note">Usually under 5 seconds. You can leave this page; the check keeps going and the result waits here.</p>
          </section>
          <div className="dc-skel" aria-hidden>
            <div className="dc-skel__tv">
              <span className="dc-path" />
            </div>
            <div className="dc-skel__side">
              <i />
              <i />
              <i />
            </div>
          </div>
          <button className="dv-btn dv-btn--ghost dc-fix" data-bot="cancel-read" onClick={() => go("console-empty")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Interrupted: the private test cast dropped. Nothing was published; the manifest is still valid. */
export function Dropped({ go }: { go: Go }) {
  return (
    <div className="dc-page">
      <ConsoleHead crumb="Add a game" title="Peekaboo Garden" step={2} />
      <div className="dc-work">
        <div className="dc-left">
          <Editor
            text={PEEK_MANIFEST}
            issues={[]}
            status={
              <span className="dc-pill dc-pill--ok">
                <Check size={14} /> Valid
              </span>
            }
          />
          <p className="dc-leftnote">Your manifest didn't change. Only the test stopped.</p>
        </div>
        <div className="dc-side">
          <section className="dc-panel dc-panel--warn" aria-label="Test stopped">
            <h2 className="dc-panel__h dc-panel__h--warn">
              <Warn /> The test on Living room TV stopped at 7:14 pm
            </h2>
            <p className="dc-panel__p">
              <L>The TV stopped answering 2 min 40 s in (it went to sleep or lost Wi-Fi).</L>
              <L>Your game was fine: the cloud browser was still drawing frames.</L>
              <L><b>Nothing was published</b>, and no other household saw it.</L>
            </p>
          </section>
          <div className="dc-dropped">
            <Previews gameId="peekaboo-garden" />
            <span className="dc-dropped__tag">
              <span className="dc-dropped__dot" aria-hidden /> Last frame · 7:14 pm
            </span>
          </div>
          <div className="dc-test dc-test--stopped">
            <div className="dc-test__now">
              <span className="dc-casting">Test stopped</span>
              <b>Living room TV</b>
              <span>Cast again from where it stopped, or publish without a test.</span>
            </div>
            <div className="dc-test__btns">
              <TvButton label="Cast again" bot="recast-test" onClick={() => go("console-preview")} />
              <button className="dv-btn dv-btn--ink" data-bot="publish" onClick={() => go("console-live")}>
                Publish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Undone, the aside on the Live page: what families see after the game is taken down. */
export function AfterUnpublish({ go }: { go: Go }) {
  const g = gameById("peekaboo-garden");
  return (
    <aside className="dc-next dc-next--after">
      <h2>What families see now</h2>
      <div className="dc-after__tile" aria-label="The tile in a family's library">
        <span className="dc-after__art">
          <GameArt gameId={g.id} alt />
        </span>
        <span>
          <b>{g.name}</b>
          <span>Taken down by its maker</span>
        </span>
      </div>
      <ol className="dc-after">
        <li className="is-homes">
          <span className="dc-after__who" aria-hidden>
            {HOUSEHOLDS.map((h) => (
              <Crest key={h.id} household={h} size={34} />
            ))}
          </span>
          <span>
            <b>3 homes that added it</b>
            <span> keep this tile, greyed, for 30 days. It leaves their library after that.</span>
          </span>
        </li>
        <li>
          <span className="dc-after__icon" aria-hidden>
            <Check size={16} />
          </span>
          <span>
            <b>Anyone playing right now</b>
            <span> finishes their sitting. OGS never cuts a cast.</span>
          </span>
        </li>
        <li>
          <span className="dc-after__icon dc-after__icon--off" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </span>
          <span>
            <b>New homes</b>
            <span> can't find it on the Together on the TV shelf.</span>
          </span>
        </li>
      </ol>
      <p className="dc-after__note">Publish again within 30 days and every tile comes back where it was.</p>
      <button className="dv-btn dv-btn--ink" data-bot="republish" onClick={() => go("console-live")}>
        Publish again
      </button>
    </aside>
  );
}
