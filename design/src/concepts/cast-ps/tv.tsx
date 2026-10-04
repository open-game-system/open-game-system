// The TV: one cast session. The launcher hosts each game's TV view inside the same stream.
import { HOME, gameById, person, type GameManifest } from "../../world";
import { duelById, instanceFor, resumeLabel, resumeShort, roleFor, ROW, type HubCard } from "./data";
import { ccItems, focusedGame, hubOf, PICK_PEOPLE } from "./nav";
import type { S } from "./state";
import { GameArt, Mark, Sticker, TileArt, TvGlyph } from "./ui";

export function TvSurface({ s }: { s: S }) {
  if (s.cast === "none" || s.cast === "picking" || s.cast === "no-tv" || s.cast === "dropped") return <Ambient dropped={s.cast === "dropped"} />;
  if (s.cast === "connecting" || s.cast === "recasting") return <Boot s={s} />;
  const tv = s.tv;
  if (tv.kind === "game") return <GameView g={gameById(tv.gameId)} />;
  if (tv.kind === "control") return <ControlCentre s={s} gameId={tv.gameId} />;
  if (tv.kind === "switching") return <Switching s={s} from={tv.from} to={tv.to} />;
  if (tv.kind === "handoff") return <Handoff s={s} duelId={tv.duelId} played={tv.played} />;
  return <Launcher s={s} />;
}

/** The Chromecast's own idle screen: nothing from OGS is running. */
function Ambient({ dropped }: { dropped: boolean }) {
  return (
    <div className="cp-tv cp-ambient">
      <div className="cp-ambient-clock">7:10</div>
      <div className="cp-ambient-name">
        <TvGlyph size={34} /> Living room TV {dropped ? "· the cast ended" : "· ready to cast"}
      </div>
    </div>
  );
}

function Boot({ s }: { s: S }) {
  const resuming = s.cast === "recasting";
  const gameId = s.tv.kind === "game" || s.tv.kind === "control" ? s.tv.gameId : undefined;
  const g = gameId ? gameById(gameId) : undefined;
  return (
    <div className="cp-tv cp-boot">
      {g && <GameArt g={g} className="cp-boot-art" />}
      <div className="cp-boot-mark">
        <Mark size={140} color="#f4f1ea" />
        <span className="cp-boot-orbit" />
      </div>
      <div className="cp-boot-line">{g ? `Picking up ${g.name} at ${resumeShort(resumeLabel(g.id, s.suspended))}` : resuming ? "Picking up where you were" : "OGS is starting on this TV"}</div>
      <div className="cp-boot-sub">{person(s.remote).name}&rsquo;s phone is the remote</div>
    </div>
  );
}

function TopBar({ s }: { s: S }) {
  return (
    <div className="cp-top">
      <div className="cp-brand">
        <Mark size={44} color="#f4f1ea" />
      </div>
      <div className="cp-row">
        {ROW.map((g, i) => {
          const focused = i === s.row;
          const ring = focused && s.zone === "row";
          const hub = hubOf({ ...s, row: i });
          return (
            <div key={g.id} className={`cp-icon ${focused ? "is-focused" : ""} ${ring ? "is-ring" : ""}`}>
              <GameArt g={g} safe className="cp-icon-art" />
              {s.tv.kind === "launcher" && s.suspended[g.id] && <span className="cp-icon-pause" />}
              {hub.badge && !focused && <span className="cp-icon-badge" style={{ background: g.palette.accent }}>{/^\d+$/.test(hub.badge) ? hub.badge : ""}</span>}
              {focused && <span className="cp-icon-name">{g.name}</span>}
            </div>
          );
        })}
      </div>
      <div className="cp-here">
        <div className="cp-here-stickers">
          {HOME.people.map((p) => (
            <Sticker key={p.id} src={p.sticker} size={52} dim={!s.playing.includes(p.id) && p.id !== s.remote} />
          ))}
        </div>
        <span className="cp-clock">7:10</span>
      </div>
    </div>
  );
}

function Backdrop({ g }: { g: GameManifest }) {
  return (
    <div className="cp-backdrop" key={g.id}>
      {g.art.tv ? <GameArt g={g} safe className="cp-backdrop-art" /> : <TileArt g={g} big className="cp-backdrop-art" />}
      <div className="cp-backdrop-shade" />
    </div>
  );
}

function Card({ c, focused, g }: { c: HubCard; focused: boolean; g: GameManifest }) {
  return (
    <div className={`cp-card ${focused ? "is-ring" : ""} tone-${c.tone}`}>
      {c.art && (
        <span className="cp-card-art">
          <img src={c.art} alt="" />
        </span>
      )}
      {c.tone === "quiet" && (
        <span className="cp-card-glyph">
          <Mark size={64} color="rgba(244,241,234,0.55)" />
        </span>
      )}
      {c.stickers && !c.art && (
        <span className="cp-card-stickers">
          {c.stickers.slice(0, 3).map((x, i) => (
            <Sticker key={i} src={x} size={72} style={{ marginLeft: i ? -18 : 0 }} />
          ))}
        </span>
      )}
      <span className="cp-card-text">
        <span className="cp-card-kicker" style={c.tone === "accent" ? { color: lift(g.palette.accent) } : undefined}>
          {c.kicker}
        </span>
        <span className="cp-card-title">{c.title}</span>
        {c.detail && <span className="cp-card-detail">{c.detail}</span>}
      </span>
    </div>
  );
}

/** Accent colours from manifests can be dark; on our glass they must stay legible. */
function lift(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (l > 150) return hex;
  const k = 150 / Math.max(l, 1);
  const c = (v: number) => Math.min(255, Math.round(v * k + 40));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

function Launcher({ s }: { s: S }) {
  const g = focusedGame(s);
  const hub = hubOf(s);
  return (
    <div className="cp-tv cp-launcher">
      <Backdrop g={g} />
      <div className="cp-under" inert={s.tv.kind === "picker"}>
      <TopBar s={s} />
      <div className="cp-hub" key={g.id}>
        <h1 className="cp-hub-title">{g.name}</h1>
        <p className="cp-hub-status">{hub.status}</p>
        {hub.actions.length > 0 && (
          <div className="cp-actions">
            {hub.actions.map((a, i) => (
              <span key={a.kind} className={`cp-btn ${i === 0 ? "is-primary" : ""} ${s.zone === "actions" && s.zi === i ? "is-ring" : ""}`}>
                {i === 0 && <PlayGlyph />}
                {a.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="cp-cards">
        {hub.cards.map((c, i) => (
          <Card key={c.id} c={c} g={g} focused={s.zone === "cards" && s.zi === i} />
        ))}
      </div>
      {s.fresh && (
        <div className="cp-notice">
          <PhoneGlyph /> {person(s.remote).name}&rsquo;s phone is the remote · swipe or click to choose
        </div>
      )}
      {s.notice && !s.fresh && <div className="cp-notice">{s.notice}</div>}
      </div>
      {s.tv.kind === "picker" && <Picker s={s} gameId={s.tv.gameId} fresh={s.tv.fresh} />}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <path d="M9 6 L24 15 L9 24Z" fill="currentColor" />
    </svg>
  );
}
function PhoneGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <rect x="8" y="3" width="14" height="24" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M13 23h4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

const deviceOf = (personId: string, phone: string) => {
  if (personId === phone) return "this remote";
  const d = HOME.devices.find((x) => x.personId === personId && x.kind === "ipad") ?? HOME.devices.find((x) => x.personId === personId);
  if (!d) return "watching";
  return d.kind === "ipad" ? (d.battery !== undefined && d.battery < 0.15 ? `iPad · ${Math.round(d.battery * 100)}%` : "iPad") : "phone";
};

function Picker({ s, gameId, fresh }: { s: S; gameId: string; fresh: boolean }) {
  const g = gameById(gameId);
  const at = resumeLabel(gameId, s.suspended);
  return (
    <div className="cp-picker">
      <h2 className="cp-picker-title">Who&rsquo;s playing {g.name}?</h2>
      <div className="cp-picker-people">
        {PICK_PEOPLE.map((p, i) => {
          const on = s.playing.includes(p.id) || p.id === s.phone;
          const role = roleFor(g, p);
          return (
            <div key={p.id} className={`cp-pick ${on ? "is-on" : ""} ${s.pickI === i ? "is-focus" : ""}`}>
              <span className="cp-pick-disc" style={on ? { boxShadow: `0 0 0 8px ${g.palette.accent}, 0 0 60px ${g.palette.accent}` } : undefined}>
                <img src={p.sticker} alt="" />
                {on && <span className="cp-pick-check" style={{ background: g.palette.accent }}><Check /></span>}
              </span>
              <span className="cp-pick-name">{p.name}</span>
              <span className="cp-pick-role">{on ? `${role?.label ?? ""} · ${deviceOf(p.id, s.phone)}` : "Not playing"}</span>
            </div>
          );
        })}
      </div>
      <span className={`cp-btn is-primary cp-picker-start ${s.pickI === PICK_PEOPLE.length ? "is-ring" : ""}`}>
        <PlayGlyph />
        {fresh || !at ? `Start ${g.name}` : `Start · ${resumeShort(at)}`}
      </span>
    </div>
  );
}

function Check() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <path d="M8 18l6 6 12-13" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A running game: the game's own TV view fills the stream. OGS draws nothing on top. */
function GameView({ g }: { g: GameManifest }) {
  return (
    <div className="cp-tv cp-game" key={g.id}>
      <GameArt g={g} className="cp-game-art" />
    </div>
  );
}

function ControlCentre({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const items = ccItems(s, gameId);
  const at = resumeLabel(gameId, s.suspended);
  return (
    <div className="cp-tv cp-cc-wrap">
      <div className="cp-cc-game">
        <GameArt g={g} className="cp-game-art" />
      </div>
      <div className="cp-cc">
        <div className="cp-cc-head">
          <span className="cp-cc-paused">
            <span className="cp-pausebars" /> {g.name} is suspended at {resumeShort(at)}
          </span>
          <span className="cp-cc-devices">
            <span className="cp-cc-dev"><TvGlyph size={30} /> Living room TV</span>
            {s.playing.map((id) => {
              const p = person(id);
              const dev = id === s.phone ? "remote" : deviceOf(id, s.phone);
              return (
                <span key={id} className="cp-cc-dev">
                  <Sticker src={p.sticker} size={44} /> {dev === "iPad" || dev.startsWith("iPad") ? dev.replace("iPad", `${p.name}'s iPad`) : p.name}
                </span>
              );
            })}
          </span>
        </div>
        <div className="cp-cc-row">
          {items.map((id, i) => {
            const t = gameById(id);
            const current = id === gameId;
            const inst = instanceFor(id);
            const where = current ? "Resume" : s.suspended[id] ? resumeShort(s.suspended[id] ?? "") : inst && inst.status !== "completed" ? resumeShort(inst.title) : "Play";
            return (
              <div key={id} className={`cp-cc-item ${current ? "is-current" : ""} ${s.ccI === i ? "is-ring" : ""}`}>
                <GameArt g={t} safe className="cp-cc-art" />
                <span className="cp-cc-label">
                  <span className="cp-cc-name">{current ? "Resume" : t.name}</span>
                  <span className="cp-cc-where">{current ? resumeShort(at) : where}</span>
                </span>
              </div>
            );
          })}
          <div className="cp-cc-sep" />
        </div>
      </div>
    </div>
  );
}

function Switching({ s, from, to }: { s: S; from: string; to: string }) {
  const a = gameById(from);
  const b = gameById(to);
  const at = resumeLabel(to, s.suspended);
  return (
    <div className="cp-tv cp-switch">
      <GameArt g={a} className="cp-switch-out" />
      <GameArt g={b} className="cp-switch-in" />
      <div className="cp-switch-saved">
        <span className="cp-pausebars" /> {a.name} saved at {resumeShort(resumeLabel(from, s.suspended))}
      </div>
      <div className="cp-switch-card">
        <span className="cp-switch-name">{b.name}</span>
        <span className="cp-switch-at">{resumeShort(at) || "New game"}</span>
        <span className="cp-switch-crew">
          {s.playing.map((id) => {
            const p = person(id);
            return (
              <span key={id} className="cp-switch-who">
                <Sticker src={p.sticker} size={64} ring={b.palette.accent} />
                <span>{roleFor(b, p)?.label}</span>
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}

function Handoff({ s, duelId, played }: { s: S; duelId: string; played: boolean }) {
  const d = duelById(duelId);
  const g = ROW.find((x) => x.shape === "async") ?? focusedGame(s);
  if (!d) return null;
  return (
    <div className="cp-tv cp-handoff">
      <div className="cp-handoff-bg" style={{ background: `radial-gradient(90% 90% at 50% 40%, ${g.palette.accent} 0%, #0b0b10 75%)` }} />
      <div className="cp-handoff-panel">
        <Sticker src={d.sticker} size={150} ring={d.color} />
        <span className="cp-handoff-kicker">{played ? `${d.opponent}'s turn now` : `Your move against ${d.opponent}`}</span>
        <span className="cp-handoff-title">{played ? "You played TONAL for 26" : `Playing on ${person(s.phone).name}'s phone`}</span>
        <span className="cp-handoff-score">
          <span>You {played ? d.you + 26 : d.you}</span>
          <span className="cp-handoff-dash">–</span>
          <span>{d.opponent} {d.them}</span>
        </span>
        {d.lastWord && !played && (
          <span className="cp-handoff-word">
            {[...d.lastWord].map((ch, i) => (
              <span key={i} className="cp-tile" style={{ background: "#fffaf0", color: g.palette.ink }}>{ch}</span>
            ))}
          </span>
        )}
        <span className="cp-handoff-note">{played ? "Back to the launcher in a moment" : "Your tiles stay on your phone"}</span>
      </div>
    </div>
  );
}
