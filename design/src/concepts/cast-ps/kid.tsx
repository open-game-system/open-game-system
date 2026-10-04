// A paired kid iPad: no words, nothing to navigate. It follows whatever the TV is doing, by name.
import { HOME, gameById, person, type GameManifest } from "../../world";
import { focusedGame } from "./nav";
import type { S } from "./state";
import { GameArt, TvGlyph } from "./ui";

export function KidSurface({ s, seat }: { s: S; seat: string }) {
  const me = person(seat);
  const device = HOME.devices.find((d) => d.personId === seat && d.kind === "ipad");
  const low = device?.battery !== undefined && device.battery < 0.15;
  const tv = s.tv;
  const on = s.cast === "on";
  const mine = s.playing.includes(seat);
  let body;
  if (on && (tv.kind === "game" || tv.kind === "control") && mine) body = <Controls g={gameById(tv.gameId)} band={me.band} paused={tv.kind === "control"} />;
  else if (on && tv.kind === "switching" && mine) body = <Follow from={gameById(tv.from)} to={gameById(tv.to)} sticker={me.sticker} />;
  else if (on && tv.kind === "picker") body = <Called g={gameById(tv.gameId)} sticker={me.sticker} lit={mine} />;
  else body = <Rest sticker={me.sticker} tvOn={on} launcherGame={on && tv.kind === "launcher" ? focusedGame(s) : undefined} waiting={s.cast === "connecting" || s.cast === "recasting"} />;
  return (
    <div className="kk">
      {body}
      {low && <Battery />}
    </div>
  );
}

/** TV off or on the launcher: my sticker, resting; a little TV that wakes up when the cast is on. */
function Rest({ sticker, tvOn, waiting, launcherGame }: { sticker: string; tvOn: boolean; waiting: boolean; launcherGame?: GameManifest }) {
  return (
    <div className={`kk-rest ${tvOn ? "is-on" : ""}`}>
      {launcherGame && <GameArt g={launcherGame} className="kk-rest-art" key={launcherGame.id} />}
      <span className={`kk-tv ${tvOn ? "is-on" : ""} ${waiting ? "is-waking" : ""}`}>
        <TvGlyph size={96} />
      </span>
      <span className="kk-me">
        <img src={sticker} alt="" />
      </span>
      <span className="kk-shadow" />
    </div>
  );
}

/** Who's playing on the TV: my iPad lights up in the game's colours when I'm picked. */
function Called({ g, sticker, lit }: { g: GameManifest; sticker: string; lit: boolean }) {
  return (
    <div className={`kk-called ${lit ? "is-lit" : ""}`} style={{ background: g.palette.ground }}>
      <GameArt g={g} className="kk-called-art" />
      <span className="kk-called-ring" style={{ borderColor: lit ? g.palette.accent : "transparent", filter: lit ? `drop-shadow(0 0 60px ${g.palette.accent})` : undefined }}>
        <img src={sticker} alt="" />
      </span>
    </div>
  );
}

/** Between games: my sticker carries me from the old game into the next one. */
function Follow({ from, to, sticker }: { from: GameManifest; to: GameManifest; sticker: string }) {
  return (
    <div className="kk-follow" style={{ background: to.palette.ground }}>
      <GameArt g={from} className="kk-follow-out" />
      <GameArt g={to} className="kk-follow-in" />
      <span className="kk-follow-me" style={{ borderColor: to.palette.accent }}>
        <img src={sticker} alt="" />
      </span>
    </div>
  );
}

/** The game's own kid controls (stand-in): big shapes in its palette; one giant button for littles. */
function Controls({ g, band, paused }: { g: GameManifest; band: string; paused: boolean }) {
  const little = band === "little";
  return (
    <div className={`kk-ctrl ${paused ? "is-paused" : ""}`} style={{ background: g.palette.ground }}>
      <GameArt g={g} className="kk-ctrl-art" />
      <div className="kk-ctrl-pads">
        {little ? (
          <span className="kk-btn is-giant" style={{ background: g.palette.accent }}>
            <Shape kind="star" color={g.palette.ink} />
          </span>
        ) : (
          (["circle", "star", "tri"] as const).map((k, i) => (
            <span key={k} className="kk-btn" style={{ background: [g.palette.accent, g.palette.accent2, g.palette.ink][i] }}>
              <Shape kind={k} color={i === 2 ? g.palette.ground : g.palette.ink} />
            </span>
          ))
        )}
      </div>
      {paused && (
        <span className="kk-pause">
          <span />
          <span />
        </span>
      )}
    </div>
  );
}

function Shape({ kind, color }: { kind: "circle" | "star" | "tri"; color: string }) {
  if (kind === "circle") return <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="34" fill={color} /></svg>;
  if (kind === "tri") return <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden><path d="M50 14 L88 82 H12Z" fill={color} strokeLinejoin="round" /></svg>;
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden>
      <path d="M50 8l12 27 29 3-22 20 7 29-26-15-26 15 7-29-22-20 29-3z" fill={color} />
    </svg>
  );
}

function Battery() {
  return (
    <span className="kk-batt" aria-hidden>
      <span className="kk-batt-fill" />
    </span>
  );
}

