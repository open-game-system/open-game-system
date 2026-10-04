// The grown-up phone: cast first, then a touchpad remote (or the same launcher as a list), then
// each game's controller with an always-there Home button.
import type { ReactNode } from "react";
import type { Store } from "../../harness/store";
import { DUELS, HOME, gameById, person } from "../../world";
import { duelById, hubFor, instanceFor, resumeLabel, resumeShort, roleFor, ROW } from "./data";
import { back, ccItems, clickHint, doAction, doCard, focusedGame, home, move, PICK_PEOPLE, select, startGame, switchTo, togglePerson, type Dir } from "./nav";
import type { S } from "./state";
import { GameArt, Mark, Sticker, TvGlyph } from "./ui";

type P = { s: S; store: Store<S> };

export function PhoneSurface({ s, store }: P) {
  if (s.phone !== s.remote && s.remoteAsleep) return <TakeRemote s={s} store={store} />;
  if (s.cast === "none" || s.cast === "picking" || s.cast === "no-tv") return <CastStart s={s} store={store} />;
  if (s.cast === "connecting" || s.cast === "recasting") return <Connecting s={s} />;
  if (s.cast === "dropped") return <Dropped s={s} store={store} />;
  const tv = s.tv;
  if (tv.kind === "handoff") return <DuelBoard s={s} store={store} duelId={tv.duelId} played={tv.played} />;
  if (tv.kind === "game" || tv.kind === "switching") return <Controller s={s} store={store} gameId={tv.kind === "game" ? tv.gameId : tv.to} />;
  return s.phoneMode === "remote" ? <Remote s={s} store={store} /> : <Browse s={s} store={store} />;
}

function Bar({ s, store, right }: P & { right?: ReactNode }) {
  return (
    <div className="pp-bar">
      <span className="pp-bar-tv">
        <span className="pp-live" />
        <TvGlyph size={22} /> Living room TV
      </span>
      {right ?? (
        <span className="pp-seg" role="tablist">
          <button data-bot="mode-remote" className={s.phoneMode === "remote" ? "is-on" : ""} onClick={() => store.update((x) => ({ ...x, phoneMode: "remote" }))}>
            Remote
          </button>
          <button data-bot="mode-browse" className={s.phoneMode === "browse" ? "is-on" : ""} onClick={() => store.update((x) => ({ ...x, phoneMode: "browse" }))}>
            List
          </button>
        </span>
      )}
    </div>
  );
}

function CastStart({ s, store }: P) {
  const turns = DUELS.filter((d) => d.status === "yourTurn");
  return (
    <div className="pp pp-start">
      <div className="pp-start-body" inert={s.cast !== "none"}>
      <div className="pp-start-head">
        <Mark size={34} color="#f4f1ea" />
        <span className="pp-start-hi">Good evening, {person(s.phone).name}</span>
      </div>
      <div className="pp-hero">
        <div className="pp-hero-tv">
          <div className="pp-hero-screen">
            {ROW.slice(0, 5).map((g, i) => (
              <GameArt key={g.id} g={g} safe className={`pp-hero-icon ${i === 0 ? "is-big" : ""}`} />
            ))}
          </div>
        </div>
        <h1 className="pp-hero-title">Start on the TV</h1>
        <p className="pp-hero-body">Cast once. Every game tonight plays in that one cast, so switching games never reloads the TV.</p>
        <button className="pp-primary" data-bot="cast-open" onClick={() => store.update((x) => ({ ...x, cast: "picking" }))}>
          <TvGlyph size={24} /> Cast to a TV
        </button>
      </div>
      <div className="pp-offtv">
        <span className="pp-offtv-label">On your phone, no TV needed</span>
        {turns.map((d) => (
          <div key={d.id} className="pp-offtv-row">
            <Sticker src={d.sticker} size={40} />
            <span className="pp-offtv-text">
              <b>Word Duel · your turn</b>
              <span>{d.lastMove}</span>
            </span>
          </div>
        ))}
      </div>
      </div>
      {(s.cast === "picking" || s.cast === "no-tv") && <TvSheet s={s} store={store} />}
    </div>
  );
}

function TvSheet({ s, store }: P) {
  const tvs = HOME.devices.filter((d) => d.kind === "tv");
  return (
    <>
      <button className="pp-scrim" aria-label="Close" data-bot="sheet-close" onClick={() => store.update((x) => ({ ...x, cast: "none" }))} />
      <div className="pp-sheet">
        <span className="pp-grab" />
        {s.cast === "no-tv" ? (
          <div className="pp-notv">
            <span className="pp-notv-icon"><TvGlyph size={40} /></span>
            <h2>No TV found on HomeNet</h2>
            <p>Your phone and the TV need the same Wi‑Fi. Check the TV is on, then look again.</p>
            <button className="pp-primary" data-bot="tv-retry" onClick={() => store.update((x) => ({ ...x, cast: "picking" }))}>
              Look again
            </button>
            <span className="pp-notv-alt">Word Duel and game nights still work on this phone.</span>
          </div>
        ) : (
          <>
            <h2 className="pp-sheet-title">Cast OGS to…</h2>
            {tvs.map((t) => (
              <button
                key={t.id}
                className={`pp-tvrow ${t.online ? "" : "is-off"}`}
                data-bot={t.online ? "tv-living" : undefined}
                disabled={!t.online}
                onClick={() => store.update((x) => ({ ...x, cast: "connecting" }))}
              >
                <span className="pp-tvrow-icon"><TvGlyph size={30} /></span>
                <span className="pp-tvrow-text">
                  <b>{t.name}</b>
                  <span>{t.online ? "Chromecast · on HomeNet" : "Off · last seen Tuesday"}</span>
                </span>
                {t.online && <span className="pp-chev" aria-hidden>›</span>}
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function Connecting({ s }: { s: S }) {
  const g = s.tv.kind === "game" ? gameById(s.tv.gameId) : undefined;
  return (
    <div className="pp pp-connect">
      <div className="pp-connect-ring">
        <Mark size={84} color="#f4f1ea" />
        <span className="pp-connect-orbit" />
      </div>
      <h1>{g ? `Picking up ${g.name}` : "Opening OGS on Living room TV"}</h1>
      <p>{g ? `At ${resumeShort(resumeLabel(g.id, s.suspended))}. The iPads come back on their own.` : "This phone becomes the remote."}</p>
    </div>
  );
}

function Dropped({ s, store }: P) {
  const g = s.tv.kind === "game" || s.tv.kind === "control" ? gameById(s.tv.gameId) : undefined;
  return (
    <div className="pp pp-dropped">
      <Bar s={s} store={store} right={<span className="pp-bar-off">Disconnected</span>} />
      <div className="pp-drop-card">
        {g && <GameArt g={g} safe className="pp-drop-art" />}
        <h1>The TV lost the cast</h1>
        <p>{g ? `${g.name} is saved at ${resumeShort(resumeLabel(g.id, s.suspended))}. Juneau's and Ava's iPads are waiting.` : "The launcher comes back where you left it."}</p>
        <button className="pp-primary" data-bot="recast" onClick={() => store.update((x) => ({ ...x, cast: "recasting" }))}>
          <TvGlyph size={24} /> Cast again
        </button>
        <span className="pp-drop-note">Nothing was lost. Casting again resumes, it doesn&rsquo;t restart.</span>
      </div>
    </div>
  );
}

function TakeRemote({ s, store }: P) {
  const holder = person(s.remote);
  const tv = s.tv;
  const on = tv.kind === "game" || tv.kind === "control" ? `${gameById(tv.gameId).name} is on` : "The launcher is on";
  return (
    <div className="pp pp-take">
      <div className="pp-start-head">
        <Mark size={34} color="#f4f1ea" />
        <span className="pp-start-hi">{person(s.phone).name}</span>
      </div>
      <div className="pp-take-card">
        <span className="pp-take-tv"><span className="pp-live" /><TvGlyph size={26} /> Living room TV · {on}</span>
        <div className="pp-take-who">
          <Sticker src={holder.sticker} size={64} dim />
          <span>
            <b>{holder.name}&rsquo;s phone went to sleep</b>
            <span>Any grown-up in the house can be the remote.</span>
          </span>
        </div>
        <button className="pp-primary" data-bot="take-remote" onClick={() => store.update((x) => ({ ...x, remote: x.phone, remoteAsleep: false, notice: `${person(x.phone).name} has the remote` }))}>
          Take the remote
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- remote

function NowCard({ s }: { s: S }) {
  const tv = s.tv;
  const g = tv.kind === "control" || tv.kind === "picker" ? gameById(tv.gameId) : focusedGame(s);
  const where = tv.kind === "control" ? "Suspended · control centre on TV" : tv.kind === "picker" ? "Who's playing · on TV" : "On the TV";
  return (
    <div className="pp-now">
      <GameArt g={g} safe className="pp-now-art" />
      <span className="pp-now-text">
        <span className="pp-now-where">{where}</span>
        <b>{g.name}</b>
      </span>
    </div>
  );
}

const PAD: { dir: Dir; label: string }[] = [
  { dir: "up", label: "Up" },
  { dir: "down", label: "Down" },
  { dir: "left", label: "Left" },
  { dir: "right", label: "Right" },
];

function Remote({ s, store }: P) {
  const hint = clickHint(s);
  const inGame = s.tv.kind === "control";
  return (
    <div className="pp pp-remote">
      <Bar s={s} store={store} />
      <NowCard s={s} />
      <div className="pp-hint">
        <span className="pp-hint-k">Click</span>
        <span className="pp-hint-v">{hint}</span>
      </div>
      <div className="pp-pad">
        <span className="pp-pad-sheen" />
        {PAD.map((p) => (
          <button key={p.dir} className={`pp-pad-zone z-${p.dir}`} data-bot={`pad-${p.dir}`} aria-label={p.label} onClick={() => store.update((x) => move(x, p.dir))}>
            <Chevron dir={p.dir} />
          </button>
        ))}
        <button className="pp-pad-click" data-bot="pad-select" aria-label="Click" onClick={() => store.update(select)} />
        <span className="pp-pad-help">Swipe to move · click to choose</span>
      </div>
      <div className="pp-keys">
        <button className="pp-key" data-bot="back" onClick={() => store.update(back)}>
          <BackGlyph />
          <span>{inGame ? "Resume" : "Back"}</span>
        </button>
        <button className="pp-key is-home" data-bot="home" onClick={() => store.update(home)}>
          <Mark size={30} color="#14131a" />
          <span>Home</span>
        </button>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: Dir }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
      <path d="M6 16l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BackGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <path d="M11 7l-6 6 6 6M5 13h11a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- the launcher as a list

function Browse({ s, store }: P) {
  const tv = s.tv;
  return (
    <div className="pp pp-browse">
      <Bar s={s} store={store} />
      {tv.kind === "picker" ? <BrowsePicker s={s} store={store} gameId={tv.gameId} /> : tv.kind === "control" ? <BrowseControl s={s} store={store} gameId={tv.gameId} /> : <BrowseList s={s} store={store} />}
      <div className="pp-browse-keys">
        <button className="pp-key is-home is-wide" data-bot="home" onClick={() => store.update(home)}>
          <Mark size={26} color="#14131a" />
          <span>Home</span>
        </button>
      </div>
    </div>
  );
}

function BrowseList({ s, store }: P) {
  return (
    <div className="pp-list">
      {ROW.map((g, i) => {
        const hub = hubFor(g, s.suspended, s.duelsPlayed);
        const open = i === s.row;
        return (
          <div key={g.id} className={`pp-game ${open ? "is-open" : ""}`}>
            <button className="pp-game-row" data-bot={`browse-${g.id}`} onClick={() => store.update((x) => ({ ...x, row: i, zone: hubFor(g, x.suspended, x.duelsPlayed).actions.length ? "actions" : "cards", zi: 0, fresh: false }))}>
              <GameArt g={g} safe className="pp-game-art" />
              <span className="pp-game-text">
                <b>{g.name}</b>
                <span>{hub.status}</span>
              </span>
              {open && <span className="pp-ontv">On TV</span>}
            </button>
            {open && (
              <div className="pp-game-acts">
                {hub.actions.map((a, ai) => (
                  <button key={a.kind} className={ai === 0 ? "pp-primary is-small" : "pp-secondary"} data-bot={`browse-act-${a.kind}`} onClick={() => store.update((x) => doAction(x, a))}>
                    {a.label}
                  </button>
                ))}
                {hub.cards.filter((c) => c.action.kind === "duel").map((c) => (
                  <button key={c.id} className="pp-turn" data-bot={`browse-card-${c.id}`} onClick={() => store.update((x) => doCard(x, c))}>
                    {c.stickers?.[0] && <Sticker src={c.stickers[0]} size={36} />}
                    <span>{c.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BrowsePicker({ s, store, gameId }: P & { gameId: string }) {
  const g = gameById(gameId);
  return (
    <div className="pp-panel">
      <h2 className="pp-panel-title">Who&rsquo;s playing {g.name}?</h2>
      {PICK_PEOPLE.map((p) => {
        const on = s.playing.includes(p.id) || p.id === s.phone;
        return (
          <button key={p.id} className={`pp-person ${on ? "is-on" : ""}`} data-bot={`pick-${p.id}`} onClick={() => store.update((x) => togglePerson(x, p.id))}>
            <Sticker src={p.sticker} size={48} dim={!on} />
            <span className="pp-person-text">
              <b>{p.name}</b>
              <span>{on ? roleFor(g, p)?.label : "Not playing"}</span>
            </span>
            <span className={`pp-check ${on ? "is-on" : ""}`} aria-hidden />
          </button>
        );
      })}
      <button className="pp-primary" data-bot="pick-start" onClick={() => store.update(startGame)}>
        Start {g.name}
      </button>
      <button className="pp-secondary" data-bot="pick-back" onClick={() => store.update(back)}>
        Back
      </button>
    </div>
  );
}

function BrowseControl({ s, store, gameId }: P & { gameId: string }) {
  const items = ccItems(s, gameId);
  return (
    <div className="pp-panel">
      <h2 className="pp-panel-title">{gameById(gameId).name} is suspended</h2>
      {items.map((id) => {
        const g = gameById(id);
        const current = id === gameId;
        const inst = instanceFor(id);
        return (
          <button key={id} className="pp-game-row is-boxed" data-bot={current ? "cc-resume" : `cc-${id}`} onClick={() => store.update((x) => (current ? { ...x, tv: { kind: "game", gameId } } : switchTo(x, gameId, id)))}>
            <GameArt g={g} safe className="pp-game-art" />
            <span className="pp-game-text">
              <b>{current ? `Resume ${g.name}` : g.name}</b>
              <span>{current ? resumeShort(resumeLabel(id, s.suspended)) : s.suspended[id] ?? (inst && inst.status !== "completed" ? inst.title : g.tagline)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- in a game

function Controller({ s, store, gameId }: P & { gameId: string }) {
  const g = gameById(gameId);
  const me = person(s.phone);
  const role = roleFor(g, me);
  const inst = instanceFor(gameId);
  const at = resumeLabel(gameId, s.suspended);
  return (
    <div className="pp pp-ctrl" style={{ background: g.palette.ground }}>
      <div className="pp-ctrl-bar">
        <span className="pp-ctrl-who">
          <Sticker src={me.sticker} size={36} />
          <span>{s.tv.kind === "switching" ? `Starting ${g.name}…` : `${role?.label ?? ""} · ${g.name}`}</span>
        </span>
        <button className="pp-homepill" data-bot="home" onClick={() => store.update(home)}>
          <Mark size={24} color="#14131a" /> Home
        </button>
      </div>
      <div className="pp-ctrl-game">
        <GameArt g={g} safe className="pp-ctrl-art" />
        <div className="pp-ctrl-panel" style={{ color: g.palette.ink, background: `${g.palette.ground}ee` }}>
          <span className="pp-ctrl-k" style={{ color: g.palette.ink }}>{resumeShort(at) || "New game"}</span>
          <span className="pp-ctrl-t">{inst?.detail.split(" · ").find((x) => !x.startsWith("Paused")) ?? g.tagline}</span>
          <div className="pp-ctrl-btns">
            <span className="pp-ctrl-btn" style={{ background: g.palette.accent }} />
            <span className="pp-ctrl-btn" style={{ background: g.palette.accent2 }} />
            <span className="pp-ctrl-btn is-big" style={{ background: g.palette.ink }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const RACK = ["T", "O", "N", "A", "L", "E", "S"];
function DuelBoard({ s, store, duelId, played }: P & { duelId: string; played: boolean }) {
  const d = duelById(duelId);
  if (!d) return null;
  const word = (d.lastWord ?? "").split("");
  const g = ROW.find((x) => x.shape === "async");
  const next = DUELS.find((x) => x.status === "yourTurn" && x.id !== duelId && !s.duelsPlayed.includes(x.id));
  return (
    <div className="pp pp-duel" style={g ? { background: g.palette.ground, color: g.palette.ink } : undefined}>
      <div className="pp-duel-bar">
        <span className="pp-duel-vs">
          <Sticker src={d.sticker} size={40} />
          <span>
            <b>Word Duel · {d.opponent}</b>
            <span>Only you see your tiles</span>
          </span>
        </span>
        <span className="pp-duel-score">{played ? d.you + 26 : d.you}–{d.them}</span>
      </div>
      <div className="pp-board">
        {Array.from({ length: 121 }, (_, i) => {
          const r = Math.floor(i / 11), c = i % 11;
          const theirs = r === 5 && c >= 3 && c < 3 + word.length ? word[c - 3] : undefined;
          const mine = c === 6 && r >= 1 && r < 6 ? "TONAL"[r - 1] : undefined;
          const ch = theirs ?? (mine && (played || r === 5) ? mine : undefined);
          const ghost = !played && mine && r !== 5;
          return (
            <span key={i} className={`pp-sq ${ch ? "has" : ""} ${ghost ? "ghost" : ""} ${(r + c) % 4 === 0 ? "tw" : ""}`}>
              {ch ?? (ghost ? mine : "")}
            </span>
          );
        })}
      </div>
      {played ? (
        <div className="pp-duel-done">
          <b>TONAL for 26 · sent to {d.opponent}</b>
          <span>{next ? `${next.opponent}'s game is your turn too.` : "No more turns waiting."}</span>
          <button className="pp-primary" data-bot="wd-done" onClick={() => store.update((x) => ({ ...x, tv: { kind: "launcher" }, duelsPlayed: [...x.duelsPlayed, duelId], zone: "cards", zi: 0 }))}>
            Back to the TV
          </button>
        </div>
      ) : (
        <>
          <div className="pp-rack">
            {RACK.map((ch, i) => (
              <span key={i} className={`pp-rt ${i < 5 ? "is-used" : ""}`}>{ch}</span>
            ))}
          </div>
          <div className="pp-duel-acts">
            <button className="pp-secondary" data-bot="wd-back" onClick={() => store.update(back)}>Later</button>
            <button className="pp-primary" data-bot="wd-play" onClick={() => store.update((x) => ({ ...x, tv: { kind: "handoff", duelId, played: true } }))}>
              Play TONAL · 26
            </button>
          </div>
        </>
      )}
    </div>
  );
}
