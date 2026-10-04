// The grown-up phone: cast first, then a Joy-Con-style remote (or a tile list that mirrors the TV row).
import { useRef, type ReactNode } from "react";
import type { Store } from "../../harness/store";
import { useStore } from "../../harness/store";
import { DUELS, HEARTHISLE } from "../../world";
import { PHONE_PAGES } from "./fixtures";
import {
  PEOPLE, choose, detailButtons, finishDuel, focusLabel, game, goHome, openGame, personOf, playDuel, press, resumeOf, rolesFor, startPicked, togglePick, yourTurnDuels,
  type Btn, type S,
} from "./state";
import { Logo } from "./tv";
import { GameArt, Icon, Sticker, StickerImg } from "./ui";

type Up = (fn: (s: S) => S) => void;

export function PhoneSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  const up: Up = (fn) => store.update(fn);
  return (
    <div className="sw-phone">
      <StatusBar dark={s.view.kind === "game" && s.cast === "on" && !s.duel && s.viewer === "dad" && !s.dadAsleep} />
      <PhoneBody s={s} up={up} />
    </div>
  );
}

function PhoneBody({ s, up }: { s: S; up: Up }) {
  if (s.viewer === "dad" && s.dadAsleep) return <Asleep />;
  if (s.viewer === "mom" && s.dadAsleep && s.remoteHolder === "dad") return <MomOffer s={s} up={up} />;
  if (s.cast === "off" || s.cast === "picking" || s.cast === "none-found") return <Start s={s} up={up} />;
  if (s.cast === "connecting") return <Connecting />;
  if (s.cast === "dropped" || s.cast === "recasting") return <Dropped s={s} up={up} />;
  if (s.duel) return <DuelBoard s={s} up={up} />;
  const v = s.view;
  if (v.kind === "game" && s.tonight.includes(s.viewer)) return <InGame s={s} up={up} gameId={v.gameId} />;
  return (
    <div className="sw-ctl">
      <Header s={s} up={up} />
      {s.phoneMode === "remote" || v.kind === "game" ? <Remote s={s} up={up} /> : <Browse s={s} up={up} />}
    </div>
  );
}

function StatusBar({ dark }: { dark: boolean }) {
  return (
    <div className={`sw-statusbar ${dark ? "is-dark" : ""}`} aria-hidden="true">
      <span>7:10</span>
      <span className="sw-statusbar__r"><Icon name="wifi" size={18} /><span className="sw-batt" /></span>
    </div>
  );
}

function Header({ s, up }: { s: S; up: Up }) {
  return (
    <div className="sw-ph-head">
      <span className="sw-castpill"><span className="sw-live" /> Living room TV</span>
      <div className="sw-seg" role="tablist">
        <button data-bot="mode-remote" role="tab" aria-selected={s.phoneMode === "remote"} className={s.phoneMode === "remote" ? "is-on" : ""} onClick={() => up((x) => ({ ...x, phoneMode: "remote", coach: false }))}>
          <Icon name="pad" size={18} /> Remote
        </button>
        <button data-bot="mode-list" role="tab" aria-selected={s.phoneMode === "browse"} className={s.phoneMode === "browse" ? "is-on" : ""} onClick={() => up((x) => ({ ...x, phoneMode: "browse", coach: false }))}>
          <Icon name="list" size={18} /> List
        </button>
      </div>
    </div>
  );
}

/* ---------- Cast first ---------- */

function Start({ s, up }: { s: S; up: Up }) {
  const turns = yourTurnDuels(s.duelsDone).length;
  return (
    <div className="sw-start">
      <div className="sw-start__top">
        <Logo size={56} />
        <span className="sw-start__home">The Mumms</span>
        <span className="sw-start__stickers">{PEOPLE.map((p) => <Sticker key={p.id} pid={p.id} size={36} />)}</span>
      </div>
      {s.cast === "off" && (
      <>
      <div className="sw-hero">
        <div className="sw-hero__tv">
          <div className="sw-hero__screen">
            {["rocket-crew", "bake-shop", "story-nook"].map((id) => <span key={id} className="sw-hero__mini"><GameArt g={game(id)} /></span>)}
          </div>
        </div>
        <h1 className="sw-hero__title">Put your games on the TV</h1>
        <p className="sw-hero__sub">The TV becomes your game console. This phone becomes its remote, and the kids' iPads follow along.</p>
        <button data-bot="cast" className="sw-btn is-primary is-big" onClick={() => up((x) => ({ ...x, cast: "picking" }))}>
          <Icon name="cast" size={24} /> Cast to TV
        </button>
      </div>
      <div className="sw-start__list">
        <div className="sw-label">On this phone</div>
        <div className="sw-mini">
          <span className="sw-mini__art"><GameArt g={game("word-duel")} /></span>
          <span className="sw-mini__t"><b>Word Duel</b><span>{turns} games are your turn</span></span>
        </div>
        <div className="sw-mini">
          <span className="sw-mini__art"><GameArt g={game("hearthisle")} /></span>
          <span className="sw-mini__t"><b>Hearthisle game night</b><span>Tonight at 8 · Okafors are in</span></span>
        </div>
      </div>
      </>
      )}
      {s.cast === "picking" && <PickTv up={up} />}
      {s.cast === "none-found" && <NoTv up={up} />}
    </div>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="sw-scrim">
      <button className="sw-scrim__hit" aria-label="Close" onClick={onClose} />
      <div className="sw-sheet-ph">{children}</div>
    </div>
  );
}

function PickTv({ up }: { up: Up }) {
  return (
    <Sheet onClose={() => up((x) => ({ ...x, cast: "off" }))}>
      <div className="sw-sheet-ph__title">Cast to</div>
      <button data-bot="tv-living" className="sw-tvrow" onClick={() => up((x) => ({ ...x, cast: "connecting" }))}>
        <Icon name="tv" size={30} />
        <span><b>Living room TV</b><span>Chromecast · ready</span></span>
        <span className="sw-live" />
      </button>
      <div className="sw-tvrow is-off" aria-disabled="true">
        <Icon name="tv" size={30} />
        <span><b>Bedroom TV</b><span>Off or asleep</span></span>
      </div>
      <button data-bot="tv-missing" className="sw-link" onClick={() => up((x) => ({ ...x, cast: "none-found" }))}>My TV isn't here</button>
    </Sheet>
  );
}

function NoTv({ up }: { up: Up }) {
  return (
    <Sheet onClose={() => up((x) => ({ ...x, cast: "off" }))}>
      <div className="sw-sheet-ph__title">No TV found</div>
      <p className="sw-sheet-ph__p">This phone is on <b>Mumm-Home</b> Wi-Fi. A TV shows up here when:</p>
      <ul className="sw-checks">
        <li><Icon name="tv" size={22} /> it's switched on, not just asleep</li>
        <li><Icon name="wifi" size={22} /> it's on the same Wi-Fi as this phone</li>
        <li><Icon name="cast" size={22} /> it has a Chromecast built in or plugged in</li>
      </ul>
      <button data-bot="look-again" className="sw-btn is-primary" onClick={() => up((x) => ({ ...x, cast: "picking" }))}>Look again</button>
      <button data-bot="phone-only" className="sw-btn" onClick={() => up((x) => ({ ...x, cast: "off" }))}>Play on phones for now</button>
    </Sheet>
  );
}

function Connecting() {
  return (
    <div className="sw-connecting">
      <div className="sw-connecting__tv"><Logo size={110} /></div>
      <h1 className="sw-hero__title">Opening OGS on the Living room TV</h1>
      <ul className="sw-steps">
        <li className="is-done"><Icon name="check" size={20} /> TV found</li>
        <li className="is-now"><span className="sw-spin" /> Starting your game console</li>
        <li><Icon name="ipad" size={20} /> Juneau's and Ava's iPads will follow</li>
      </ul>
    </div>
  );
}

/* ---------- The remote ---------- */

function Remote({ s, up }: { s: S; up: Up }) {
  const p = (b: Btn) => () => up((x) => press(x, b));
  const start = useRef<{ x: number; y: number } | null>(null);
  const inGame = s.view.kind === "game";
  return (
    <div className="sw-remote-wrap">
      {s.coach && (
        <div className="sw-coach">
          <b>This phone is the remote now</b>
          <span>Press the arrows or swipe the pad to move around the TV. Want to tap games here instead? Switch to List.</span>
          <button data-bot="got-it" className="sw-btn is-small" onClick={() => up((x) => ({ ...x, coach: false }))}>Got it</button>
        </div>
      )}
      <div className="sw-ontv">
        <span className="sw-ontv__k">On the TV</span>
        <span className="sw-ontv__v">{inGame ? `${focusLabel(s)} is playing` : focusLabel(s)}</span>
      </div>
      <div className={`sw-joy ${s.coach ? "is-short" : ""}`}>
        <div
          className="sw-dpad"
          onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const o = start.current;
            start.current = null;
            if (!o) return;
            const dx = e.clientX - o.x, dy = e.clientY - o.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
            up((x) => press(x, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"));
          }}
        >
          <span className="sw-dpad__swipe" aria-hidden="true" />
          {(["up", "left", "right", "down"] as const).map((d) => (
            <button key={d} data-bot={`r-${d}`} aria-label={d} className={`sw-dbtn is-${d} ${s.lastPress === d ? "is-hit" : ""}`} onClick={p(d)} disabled={inGame}>
              <Icon name={d} size={26} />
            </button>
          ))}
        </div>
        <div className="sw-ab">
          <span className="sw-ab__b">
            <button data-bot="r-b" className="sw-face" onClick={p("b")} disabled={inGame} aria-label="B, back">B</button>
            <span className="sw-face__cap">Back</span>
          </span>
          <span className="sw-ab__a">
            <button data-bot="r-a" className="sw-face is-a" onClick={p("a")} disabled={inGame} aria-label="A, select">A</button>
            <span className="sw-face__cap">Select</span>
          </span>
        </div>
        <div className="sw-sysrow">
          <span className="sw-sysrow__item">
            <button data-bot="r-list" className="sw-capture" aria-label="List on phone" onClick={() => up((x) => ({ ...x, phoneMode: "browse" }))}>
              <Icon name="list" size={24} />
            </button>
            <span className="sw-face__cap">List</span>
          </span>
          <span className="sw-sysrow__item">
            <button data-bot="r-home" className="sw-homebtn" aria-label="Home" onClick={p("home")}>
              <Icon name="home" size={28} />
            </button>
            <span className="sw-face__cap">Home</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Browse on the phone (mirrors the TV row) ---------- */

function Browse({ s, up }: { s: S; up: Up }) {
  const v = s.view;
  if (v.kind === "detail") return <BrowseDetail s={s} up={up} gameId={v.gameId} />;
  if (v.kind === "who") return <BrowseWho s={s} up={up} />;
  const focusId = s.focus.zone === "games" ? s.order[s.focus.games] : undefined;
  const turns = yourTurnDuels(s.duelsDone);
  return (
    <div className="sw-browse">
      <div className="sw-label">Games · same order as the TV</div>
      {s.order.filter((id) => game(id).shape !== "async").map((id) => {
        const g = game(id);
        const r = resumeOf(id, s);
        const on = id === focusId && v.kind === "home";
        return (
          <button key={id} data-bot={`b-${id}`} className={`sw-brow ${on ? "is-on" : ""}`} onClick={() => up((x) => openGame(x, id))}>
            <span className="sw-brow__art"><GameArt g={g} /></span>
            <span className="sw-brow__t">
              <b>{g.name}</b>
              <span>{r ? `${r.lead === "Last time" ? "" : r.lead + " · "}${r.title}` : g.tagline}</span>
            </span>
            {s.suspended === id ? <span className="sw-chip is-susp"><Icon name="pause" size={14} /> Paused</span> : on ? <span className="sw-chip">On TV</span> : null}
          </button>
        );
      })}
      <div className="sw-label">Your turn · Word Duel</div>
      {turns.map((d) => (
        <button key={d.id} data-bot={`duel-${d.id}`} className="sw-brow" onClick={() => up((x) => playDuel(x, d.id))}>
          <StickerImg src={d.sticker} size={52} color={d.color} />
          <span className="sw-brow__t"><b>{d.opponent}</b><span>{d.lastMove}</span></span>
          <span className="sw-chip">Play</span>
        </button>
      ))}
      {turns.length === 0 && <p className="sw-muted">All caught up. Every game is their move.</p>}
    </div>
  );
}

function BrowseDetail({ s, up, gameId }: { s: S; up: Up; gameId: string }) {
  const g = game(gameId);
  const r = resumeOf(gameId, s);
  const roster = s.tonight.length ? s.tonight : r?.players ?? [];
  return (
    <div className="sw-bdetail">
      <button data-bot="b-back" className="sw-back" onClick={() => up((x) => ({ ...x, view: { kind: "home" } }))}><Icon name="back" size={20} /> All games</button>
      <div className="sw-bdetail__art"><GameArt g={g} /></div>
      <h2 className="sw-bdetail__name">{g.name}</h2>
      {r && <p className="sw-bdetail__r"><b>{r.lead} · {r.title}</b><span>{r.detail}</span></p>}
      {g.shape === "couch" && roster.length > 0 && (
        <div className="sw-bdetail__who">
          {rolesFor(gameId, roster).map((x) => (
            <span key={x.pid} className="sw-bdetail__p"><Sticker pid={x.pid} size={40} /> <span><b>{personOf(x.pid).name}</b>{x.label}</span></span>
          ))}
        </div>
      )}
      {g.shape === "live" && <p className="sw-muted">{HEARTHISLE.detail}</p>}
      <div className="sw-bdetail__btns">
        {detailButtons(gameId).map((b, i) => (
          <button key={b.id} data-bot={`b-${b.id}`} className={`sw-btn ${i === 0 ? "is-primary is-big" : ""}`} onClick={() => up((x) => choose(x, gameId, b.id))}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BrowseWho({ s, up }: { s: S; up: Up }) {
  const v = s.view;
  if (v.kind !== "who") return null;
  const roles = v.gameId ? rolesFor(v.gameId, s.picking) : [];
  return (
    <div className="sw-bwho">
      <h2 className="sw-bwho__t">{v.gameId ? `Who's playing ${game(v.gameId).name}?` : "Who's here tonight?"}</h2>
      <div className="sw-bwho__grid">
        {PEOPLE.map((p) => {
          const on = s.picking.includes(p.id);
          return (
            <button key={p.id} data-bot={`who-${p.id}`} aria-pressed={on} className={`sw-bwho__p ${on ? "is-on" : ""}`} onClick={() => up((x) => togglePick(x, p.id))}>
              <Sticker pid={p.id} size={92} dim={!on} />
              <b>{p.name}</b>
              <span>{on ? roles.find((r) => r.pid === p.id)?.label ?? "Here" : "Not playing"}</span>
            </button>
          );
        })}
      </div>
      <button data-bot="who-start" className="sw-btn is-primary is-big" onClick={() => up(startPicked)} disabled={s.picking.length === 0}>
        {v.gameId ? `Start ${game(v.gameId).name}` : "Done"}
      </button>
    </div>
  );
}

/* ---------- In a game: the game's own controller, framed by an always-there OGS Home ---------- */

function InGame({ s, up, gameId }: { s: S; up: Up; gameId: string }) {
  const g = game(gameId);
  const page = PHONE_PAGES[gameId];
  const role = rolesFor(gameId, s.tonight).find((x) => x.pid === s.viewer)?.label ?? "Player";
  return (
    <div className="sw-ingame" style={{ "--gg": g.palette.ground, "--gi": g.palette.ink, "--ga": g.palette.accent, "--ga2": g.palette.accent2 }}>
      <div className="sw-ogsbar">
        <button data-bot="home" className="sw-ogsbar__home" onClick={() => up(goHome)}>
          <Icon name="home" size={24} /> Home
        </button>
        <span className="sw-ogsbar__mid">{g.name}</span>
        <span className="sw-ogsbar__who">{s.tonight.map((pid) => <Sticker key={pid} pid={pid} size={30} />)}</span>
      </div>
      <div className="sw-gpage">
        <div className="sw-gpage__art"><img src={g.art.alt ?? g.art.tv} alt="" /></div>
        <div className="sw-gpage__role">You're the {role}</div>
        <div className="sw-gpage__status">{page?.status ?? g.tagline}</div>
        <p className="sw-gpage__prompt">{page?.prompt ?? ""}</p>
        <div className="sw-gpage__acts">
          {(page?.actions ?? ["Left", "Right"]).map((a) => <button key={a} className="sw-gbtn">{a}</button>)}
        </div>
        <button className="sw-gbtn is-big">{page?.big ?? "Go"}</button>
      </div>
    </div>
  );
}

/* ---------- Word Duel: the TV hands the turn to the phone ---------- */

const RACK = ["W", "A", "V", "E", "S", "T", "O"];

function DuelBoard({ s, up }: { s: S; up: Up }) {
  const d = DUELS.find((x) => x.id === s.duel);
  if (!d) return null;
  const word = d.lastWord ?? "";
  return (
    <div className="sw-duel">
      <div className="sw-duel__head">
        <button data-bot="duel-back" className="sw-back" onClick={() => up((x) => ({ ...x, duel: null }))}><Icon name="back" size={20} /> TV</button>
        <StickerImg src={d.sticker} size={40} color={d.color} />
        <span className="sw-duel__who"><b>vs {d.opponent}</b><span>Your turn · You {d.you} · {d.opponent} {d.them}</span></span>
      </div>
      <div className="sw-duel__note"><Icon name="tv" size={18} /> The TV only shows you're taking a turn</div>
      <div className="sw-board" aria-label="Board">
        {Array.from({ length: 121 }, (_, i) => {
          const r = Math.floor(i / 11), c = i % 11;
          const wi = r === 5 ? c - 3 : -1;
          const ch = wi >= 0 && wi < word.length ? word[wi] : r === 6 && c === 4 ? "W" : r === 7 && c === 4 ? "A" : "";
          const prem = (r + c) % 6 === 0 && !ch;
          return <span key={i} className={`sw-cell ${ch ? "is-tile" : ""} ${prem ? "is-prem" : ""} ${r === 8 && c >= 4 && c <= 7 ? "is-ghost" : ""}`}>{ch}</span>;
        })}
      </div>
      <div className="sw-duel__play">WAVE · 22 points</div>
      <div className="sw-rack">{RACK.map((c, i) => <span key={i} className={`sw-rtile ${i < 4 ? "is-used" : ""}`}>{c}</span>)}</div>
      <button data-bot="duel-play" className="sw-btn is-primary is-big" onClick={() => up(finishDuel)}>Play WAVE</button>
    </div>
  );
}

/* ---------- Edge: the remote's phone sleeps; the cast drops ---------- */

function Asleep() {
  return (
    <div className="sw-asleep" aria-label="Phone asleep">
      <Icon name="moon" size={56} color="#3a3a44" />
    </div>
  );
}

function MomOffer({ s, up }: { s: S; up: Up }) {
  const v = s.view;
  const what = v.kind === "game" ? `${game(v.gameId).name} is still playing.` : "The TV is on your games home.";
  return (
    <div className="sw-start">
      <div className="sw-start__top">
        <Logo size={56} />
        <span className="sw-start__home">Mom's phone</span>
      </div>
      <div className="sw-offer">
        <span className="sw-offer__art"><Sticker pid="dad" size={96} /><span className="sw-offer__z"><Icon name="sleep" size={28} /></span></span>
        <h1 className="sw-hero__title">Jonathan's phone went to sleep</h1>
        <p className="sw-hero__sub">{what} Take over the remote from here? Jonathan can take it back any time.</p>
        <button data-bot="take-remote" className="sw-btn is-primary is-big" onClick={() => up((x) => ({ ...x, remoteHolder: "mom", phoneMode: "remote" }))}>
          <Icon name="pad" size={22} /> Take the remote
        </button>
        <button data-bot="not-now" className="sw-btn" onClick={() => up((x) => ({ ...x, dadAsleep: false }))}>Not now</button>
      </div>
    </div>
  );
}

function Dropped({ s, up }: { s: S; up: Up }) {
  const v = s.view;
  const gid = v.kind === "game" ? v.gameId : null;
  const r = gid ? resumeOf(gid, s) : null;
  const busy = s.cast === "recasting";
  return (
    <div className="sw-connecting">
      <div className="sw-connecting__tv is-lost"><Icon name="cast" size={64} /></div>
      <h1 className="sw-hero__title">{busy ? "Casting again…" : "The TV lost the cast"}</h1>
      <p className="sw-hero__sub">
        {gid ? `${game(gid).name} is saved at ${r?.title ?? "where you were"}.` : "Your home is saved as you left it."} The iPads are holding on. Nothing is lost.
      </p>
      <button data-bot="recast" className="sw-btn is-primary is-big" disabled={busy} onClick={() => up((x) => ({ ...x, cast: "recasting" }))}>
        <Icon name="cast" size={22} /> {busy ? "Connecting to Living room TV" : "Cast again"}
      </button>
    </div>
  );
}

