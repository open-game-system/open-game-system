// Shared pieces of every failure screen: the phone's calm page (one line, one action, the resume
// point on the game's own art), the banner that sits above a running game, a lock-screen push, and
// small line glyphs. Prefixed eg- (edge).
import type { ReactNode } from "react";
import { gameById, type Person } from "../../../world";
import { Mark, Portrait, StatusBar } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { Check, Spinner } from "../ui/Icons";

export type RowState = "ok" | "wait" | "off" | "busy";

export interface Row {
  key: string;
  icon: ReactNode;
  name: string;
  note: string;
  state: RowState;
}

export function Page({
  title,
  where,
  gameId,
  pointLabel,
  line,
  sub,
  model,
  rows,
  children,
  action,
  quiet,
  light = false,
}: {
  title: string;
  where: string;
  /** The game whose art carries the resume point (omit for console-level faults). */
  gameId?: string;
  /** The resume point on the art: "Paused at Mission 6". */
  pointLabel?: string;
  line: string;
  sub: string;
  /** One sentence of the session model, where it helps ("Tonight lives in OGS, not on the TV"). */
  model?: string;
  rows?: Row[];
  children?: ReactNode;
  action?: ReactNode;
  /** A quiet secondary (text link), never a second big button. */
  quiet?: ReactNode;
  light?: boolean;
}) {
  return (
    <div className={`eg-page ${light ? "eg-page--light" : ""}`}>
      <StatusBar dark={!light} />
      <header className="eg-head">
        <span className="eg-head__mark">
          <Mark size={26} />
        </span>
        <span className="eg-head__what">
          <b>{title}</b>
          <span>{where}</span>
        </span>
      </header>
      <div className="eg-sheet">
        <div className="eg-sheet__scroll">
          {gameId && (
            <div className="eg-hero">
              <GameArt gameId={gameId} />
              {pointLabel && (
                <span className="eg-hero__point">
                  <PauseGlyph />
                  {pointLabel}
                </span>
              )}
            </div>
          )}
          <h1 className="eg-line">{line}</h1>
          <p className="eg-sub">{sub}</p>
          {model && (
            <p className="eg-model">
              <Mark size={18} />
              <span>{model}</span>
            </p>
          )}
          {rows && <Rows rows={rows} />}
          {children}
        </div>
        {(action || quiet) && (
          <footer className="eg-foot">
            {action}
            {quiet}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="eg-rows">
      {rows.map((r) => (
        <li key={r.key} className={`eg-row eg-row--${r.state}`}>
          <span className="eg-row__icon">{r.icon}</span>
          <span className="eg-row__text">
            <b>{r.name}</b>
            <span>{r.note}</span>
          </span>
          <span className="eg-row__state" aria-label={r.state}>
            <StateGlyph state={r.state} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function StateGlyph({ state }: { state: RowState }) {
  if (state === "ok") return <Check size={20} />;
  if (state === "busy") return <Spinner size={20} />;
  if (state === "wait") return <PauseGlyph size={18} />;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

export function PersonIcon({ p }: { p: Person }) {
  return <Portrait person={p} size={36} />;
}

export function PauseGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <rect x="2.6" y="2.2" width="2.3" height="7.6" rx=".8" fill="currentColor" />
      <rect x="7.1" y="2.2" width="2.3" height="7.6" rx=".8" fill="currentColor" />
    </svg>
  );
}

export function Btn({ bot, children, onClick, disabled = false, busy = false }: { bot: string; children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button className="eg-btn" data-bot={bot} onClick={onClick} disabled={disabled || busy}>
      {busy && <Spinner size={20} />}
      {children}
    </button>
  );
}

export function Quiet({ bot, children, onClick }: { bot: string; children: ReactNode; onClick: () => void }) {
  return (
    <button className="eg-quiet" data-bot={bot} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * A calm line above a game that's still running (the game below keeps every pixel it had). It
 * pushes the game down instead of covering it; its own status bar replaces the game screen's.
 */
export function Banner({ tone, line, sub, action, children }: { tone: "ok" | "info"; line: string; sub: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="eg-push">
      <div className={`eg-banner eg-banner--${tone}`}>
        <StatusBar dark />
        <div className="eg-banner__body">
          <span className="eg-banner__glyph">{tone === "ok" ? <Check size={22} /> : <Mark size={22} />}</span>
          <span className="eg-banner__text">
            <b>{line}</b>
            <span>{sub}</span>
          </span>
          {action}
        </div>
      </div>
      <div className="eg-push__under">{children}</div>
    </div>
  );
}

/** A lock screen with one OGS push (pushes only ever go to grown-ups' phones). */
export function Lock({ who, title, body, bot, onOpen, hint }: { who: string; title: string; body: string; bot: string; onOpen: () => void; hint: string }) {
  return (
    <div className="eg-lock">
      <div className="eg-lock__top">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
        <span className="eg-lock__time">7:21</span>
        <span className="eg-lock__date">Friday 3 October · {who}</span>
      </div>
      <button className="eg-pushcard" data-bot={bot} onClick={onOpen}>
        <span className="eg-pushcard__app">
          <span className="eg-pushcard__icon">
            <Mark size={16} color="#fff" />
          </span>
          OGS
          <span className="eg-pushcard__when">now</span>
        </span>
        <b>{title}</b>
        <span>{body}</span>
      </button>
      <p className="eg-lock__hint">{hint}</p>
    </div>
  );
}

export const gameTitle = (id: string): string => gameById(id).name;

export function TvGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="12.5" rx="1.5" />
      <path d="M8 20.5h8" />
    </svg>
  );
}

export function HomeDot({ color }: { color: string }) {
  return <i className="eg-homedot" style={{ background: color }} />;
}
