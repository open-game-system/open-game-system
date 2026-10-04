// The developer Console: register a game by pasting its manifest, see it validated live, preview the
// library tile and the TV cast, test on your own TV, publish, then watch each tier's signal arrive.
import { GAMES, gameById } from "../../../../world";
import { GameArt } from "../../ui/GameArt";
import { Check, Plus } from "../../ui/Icons";
import { C, L } from "../Code";
import type { ConsolePage, DevPage } from "../pages";
import { MANIFEST_PATH, PEEK_MANIFEST, PEEK_MANIFEST_BROKEN } from "../samples";
import { TierChip, TierGlyph } from "../Shell";
import { Checks, ConsoleHead, Editor, Previews, Problems, TvButton, Warn } from "./parts";
import { AfterUnpublish, Dropped, Reading } from "./States";
import { validate } from "./validate";

type Go = (p: DevPage) => void;

function Empty({ go }: { go: Go }) {
  return (
    <div className="dc-page">
      <ConsoleHead crumb="Add a game" title="Your games" />
      <div className="dc-empty">
        <div className="dc-empty__art" aria-hidden>
          <span className="dc-empty__slot" />
          <span className="dc-empty__slot" />
          <span className="dc-empty__slot dc-empty__slot--add">
            <Plus size={28} />
          </span>
        </div>
        <h2>No games yet</h2>
        <p>A game joins OGS with one JSON file. Paste it here, or tell us your domain and we will read it.</p>
        <div className="dc-empty__ways">
          <button className="dc-way" data-bot="paste-manifest" onClick={() => go("console-error")}>
            <b>Paste a manifest</b>
            <span>Checked as you type, with a live preview of the library tile and the TV.</span>
            <span className="dc-way__note">
              <span className="dc-kbd">⌘V</span> anywhere on this page
            </span>
          </button>
          <div className="dc-way dc-way--domain">
            <b>Read it from my domain</b>
            <span className="dc-input">
              <span className="dc-input__ph">peekaboo-garden.jonathanrmumm.workers.dev</span>
              <button className="dv-btn dv-btn--ink" data-bot="read-domain" onClick={() => go("console-error")}>
                Read
              </button>
            </span>
            <span className="dc-way__note">
              We fetch <C>{MANIFEST_PATH}</C>
            </span>
          </div>
        </div>
        <button className="dv-link" data-bot="empty-docs" onClick={() => go("manifest")}>
          What goes in a manifest →
        </button>
      </div>
    </div>
  );
}

function ErrorState({ go }: { go: Go }) {
  const { issues } = validate(PEEK_MANIFEST_BROKEN);
  return (
    <div className="dc-page">
      <ConsoleHead crumb="Add a game" title="Peekaboo Garden" step={0} />
      <div className="dc-work">
        <Editor
          text={PEEK_MANIFEST_BROKEN}
          issues={issues}
          status={
            <span className="dc-pill dc-pill--warn">
              <Warn size={14} /> {issues.length} problems
            </span>
          }
        />
        <div className="dc-side">
          <Problems issues={issues} />
          <button className="dv-btn dv-btn--ink dc-fix" data-bot="apply-fixes" onClick={() => go("console-preview")}>
            Apply both fixes
          </button>
          <div className="dc-dimwrap">
            <Previews gameId="peekaboo-garden" dim />
            <p className="dc-dimnote">The preview appears when the manifest is valid.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewState({ go }: { go: Go }) {
  const { issues, checks } = validate(PEEK_MANIFEST);
  return (
    <div className="dc-page">
      <ConsoleHead crumb="Add a game" title="Peekaboo Garden" step={2} />
      <div className="dc-work">
        <div className="dc-left">
        <Editor
          text={PEEK_MANIFEST}
          issues={issues}
          status={
            <span className="dc-pill dc-pill--ok">
              <Check size={14} /> Valid
            </span>
          }
        />
        <p className="dc-leftnote">
          <L>Hosting it at <C>{MANIFEST_PATH}</C> too?</L>
          <L>OGS re-reads that file when you publish, so the two never drift.</L>
        </p>
        </div>
        <div className="dc-side">
          <Checks checks={checks} />
          <Previews gameId="peekaboo-garden" />
          <div className="dc-test">
            <div className="dc-test__now">
              <span className="dc-casting">
                <span className="dv-dot" aria-hidden /> Casting a private preview
              </span>
              <b>Living room TV</b>
              <span>Only your household can see this game until you publish.</span>
            </div>
            <div className="dc-test__btns">
              <TvButton label="Stop" bot="stop-test" onClick={() => go("console-error")} />
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

interface Signal {
  ok: boolean;
  text: string;
  /** Set up, waiting for its first signal to arrive. */
  wait?: boolean;
}

const SIGNALS: Record<string, [Signal, Signal | null, Signal | null]> = {
  "peekaboo-garden": [{ ok: true, text: "Published 7:10 pm" }, null, null],
  "rocket-crew": [{ ok: true, text: "Domain verified" }, { ok: true, text: "Token verified · save v3 at 7:02 pm" }, { ok: true, text: "POST 2 min ago · active" }],
  "night-flight": [{ ok: true, text: "Domain verified" }, { ok: true, text: "Token verified · Sun" }, { ok: true, text: "POST Sun 7:20 pm · completed" }],
  "bake-shop": [{ ok: true, text: "Domain verified" }, { ok: true, text: "Token verified · save v2 Tue" }, null],
  "story-nook": [{ ok: true, text: "Domain verified" }, { ok: false, text: "Save rejected 7:15 am · 409 stale version" }, null],
};

function SignalCell({ s }: { s: Signal | null }) {
  if (!s) return <span className="dc-sig dc-sig--none">Not set up</span>;
  if (s.wait)
    return (
      <span className="dc-sig dc-sig--wait">
        <span className="dc-listen" aria-hidden />
        <span>{s.text}</span>
      </span>
    );
  return (
    <span className={`dc-sig ${s.ok ? "dc-sig--ok" : "dc-sig--warn"}`}>
      {s.ok ? <Check size={15} /> : <Warn size={15} />}
      <span>{s.text}</span>
    </span>
  );
}

const LOG: { at: string; game: string; what: string; body: string; code: string; ok: boolean }[] = [
  { at: "7:08 pm", game: "Rocket Crew", what: "POST /instances", body: "rc-1 · active · Mission 6 · Navigator rank", code: "202", ok: true },
  { at: "7:02 pm", game: "Rocket Crew", what: "PUT /saves", body: "v3 · Navigator · 14 planets", code: "200", ok: true },
  { at: "7:02 pm", game: "Rocket Crew", what: "GET /me", body: "dev-juneau-ipad · Juneau · fixer", code: "200", ok: true },
  { at: "7:15 am", game: "Story Nook", what: "PUT /saves", body: "If-Match \"4\" but the slot is at v5. Reload, then save.", code: "409", ok: false },
];

/** The Live page's three moments: everything reporting, waiting on a first POST, a game taken down. */
type LiveMode = "live" | "listening" | "unpublished";

const PEEK_SIGNALS: Record<LiveMode, [Signal | null, Signal | null, Signal | null]> = {
  live: [{ ok: true, text: "Published 7:10 pm" }, null, null],
  listening: [{ ok: true, text: "Published 7:10 pm" }, { ok: true, text: "Token verified · 7:31 pm" }, { ok: true, wait: true, text: "Listening for the first POST" }],
  unpublished: [{ ok: true, text: "Unpublished 7:24 pm" }, null, null],
};

function Live({ go, mode = "live" }: { go: Go; mode?: LiveMode }) {
  const mine = GAMES.filter((g) => SIGNALS[g.id]).sort((a, b) => (a.id === "peekaboo-garden" ? -1 : b.id === "peekaboo-garden" ? 1 : b.tier - a.tier));
  const peek = gameById("peekaboo-garden");
  return (
    <div className="dc-page">
      <ConsoleHead crumb="All games" title="Your games">
        <button className="dv-btn dv-btn--ink dc-head__add" data-bot="add-game" onClick={() => go("console-empty")}>
          <Plus size={18} /> Add a game
        </button>
      </ConsoleHead>
      {mode === "live" && (
        <div className="dc-banner" role="status">
          <span className="dc-banner__icon">
            <Check size={18} />
          </span>
          <span>
            <b>{peek.name} is live.</b>
            <span> It's on the </span>
            <b>Together on the TV</b>
            <span> shelf for every household that adds it, castable today.</span>
          </span>
        </div>
      )}
      {mode === "listening" && (
        <div className="dc-banner dc-banner--wait" role="status">
          <span className="dc-listen dc-listen--lg" aria-hidden />
          <span>
            <b>Listening for {peek.name}'s first report.</b>
            <span> Families see nothing new until a valid POST lands; it shows up here within a second.</span>
          </span>
        </div>
      )}
      {mode === "unpublished" && (
        <div className="dc-banner dc-banner--off" role="status">
          <span className="dc-banner__icon dc-banner__icon--off" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </span>
          <span>
            <b>{peek.name} is unpublished.</b>
            <span> Nothing was deleted: its manifest, saves and reports are kept for 30 days.</span>
          </span>
        </div>
      )}
      <div className="dc-live">
        <div className="dc-left">
        <table className="dc-table">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">
                <TierGlyph tier={0} /> Tier 0 · listed
              </th>
              <th scope="col">
                <TierGlyph tier={1} /> Tier 1 · identity + saves
              </th>
              <th scope="col">
                <TierGlyph tier={2} /> Tier 2 · instance reports
              </th>
            </tr>
          </thead>
          <tbody>
            {mine.map((g) => {
              const [t0, t1, t2] = (g.id === "peekaboo-garden" ? PEEK_SIGNALS[mode] : SIGNALS[g.id]) ?? [null, null, null];
              const rowClass = g.id !== "peekaboo-garden" ? "" : mode === "unpublished" ? "is-off" : "is-new";
              return (
                <tr key={g.id} className={rowClass}>
                  <th scope="row">
                    <span className="dc-game">
                      <span className="dc-game__art">
                        <GameArt gameId={g.id} />
                      </span>
                      <span>
                        <b>{g.name}</b>
                        <TierChip tier={g.tier} size="sm" />
                      </span>
                    </span>
                  </th>
                  <td>
                    <SignalCell s={t0} />
                  </td>
                  <td>
                    <SignalCell s={t1} />
                  </td>
                  <td>
                    <SignalCell s={t2} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <section className="dc-log" aria-label="Recent reports">
          <h2 className="dc-log__h">
            <span className="dv-dot" aria-hidden /> Recent reports
          </h2>
          <ol>
            {mode === "listening" && (
              <li className="is-wait">
                <span className="dc-log__at">7:31 pm</span>
                <span className="dc-log__game">Peekaboo Garden</span>
                <C>GET /me</C>
                <span className="dc-log__body">dev-juneau-ipad · Juneau · finder · token verified</span>
                <span className="dc-log__code">200</span>
              </li>
            )}
            {LOG.map((l) => (
              <li key={l.at + l.what}>
                <span className="dc-log__at">{l.at}</span>
                <span className="dc-log__game">{l.game}</span>
                <C>{l.what}</C>
                <span className="dc-log__body">{l.body}</span>
                <span className={`dc-log__code ${l.ok ? "" : "is-bad"}`}>{l.code}</span>
              </li>
            ))}
          </ol>
        </section>
        </div>
        {mode === "live" && (
        <aside className="dc-next">
          <h2>Next for {peek.name}</h2>
          <p>It starts fresh every time. Two small steps would let the Mumms pick up where they left off.</p>
          <ol>
            <li>
              <TierChip tier={1} size="sm" />
              <span>
                <b>
                  <span>Read the </span>
                  <C>?ogs</C>
                  <span> token</span>
                </b>
                <span>We'll show "Token verified" here on the first one.</span>
              </span>
            </li>
            <li>
              <TierChip tier={2} size="sm" />
              <span>
                <b>POST when a garden is done</b>
                <span>"A hedgehog moved in" becomes a card on Home.</span>
              </span>
            </li>
          </ol>
          <div className="dc-next__btns">
            <button className="dv-btn dv-btn--ghost" data-bot="docs-tier1" onClick={() => go("identity")}>
              Add Tier 1
            </button>
            <button className="dv-btn dv-btn--quiet" data-bot="unpublish" onClick={() => go("console-unpublished")}>
              Unpublish
            </button>
          </div>
        </aside>
        )}
        {mode === "listening" && (
        <aside className="dc-next">
          <h2>Send one to see it here</h2>
          <p>Your key is in test mode: reports from it show only on your own household's Home.</p>
          <pre className="dc-curl">{CURL}</pre>
          <button className="dv-btn dv-btn--ghost" data-bot="docs-tier2" onClick={() => go("instances")}>
            What goes in a report
          </button>
        </aside>
        )}
        {mode === "unpublished" && <AfterUnpublish go={go} />}
      </div>
    </div>
  );
}

const CURL = `POST /api/v1/instances
Authorization: Bearer $GAME_API_KEY

{ "id": "pg-1", "household": "hh-mumm",
  "status": "completed",
  "title": "A hedgehog moved in" }`;

export function ConsoleView({ page, go }: { page: ConsolePage; go: Go }) {
  if (page === "console-empty") return <Empty go={go} />;
  if (page === "console-reading") return <Reading go={go} />;
  if (page === "console-dropped") return <Dropped go={go} />;
  if (page === "console-listening") return <Live go={go} mode="listening" />;
  if (page === "console-unpublished") return <Live go={go} mode="unpublished" />;
  if (page === "console-error") return <ErrorState go={go} />;
  if (page === "console-preview") return <PreviewState go={go} />;
  return <Live go={go} />;
}
