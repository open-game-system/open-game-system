// Console building blocks: the page head with its four steps, the manifest editor, problems,
// passing checks, and the preview of the library tile + TV cast + seats.
import type { ReactNode } from "react";
import { HOME, gameById } from "../../../../world";
import { seatPlan } from "../../state";
import { Portrait } from "../../ui/Brand";
import { Check, TvIcon } from "../../ui/Icons";
import { CodeLines } from "../Code";
import { Tile } from "../Payoff";
import type { Check as Passed, Issue } from "./validate";

export const STEPS = ["Manifest", "Preview", "Test on your TV", "Publish"];

export function Warn({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </svg>
  );
}

export function ConsoleHead({ crumb, title, step, children }: { crumb: string; title: string; step?: number; children?: ReactNode }) {
  return (
    <header className="dc-head">
      <div className="dc-head__text">
        <p className="dc-crumb">
          Your games <span aria-hidden>/</span> {crumb}
        </p>
        <h1 className="dc-h1">{title}</h1>
      </div>
      {step !== undefined && (
        <ol className="dc-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-now" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="dc-steps__n">{i < step ? <Check size={14} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
      {children}
    </header>
  );
}

export function Editor({ text, issues, status }: { text: string; issues: Issue[]; status: ReactNode }) {
  return (
    <section className="dc-editor" aria-label="Manifest">
      <div className="dc-editor__head">
        <span className="dc-editor__file">opengame-association.json</span>
        {status}
      </div>
      <CodeLines code={text} lang="json" numbers errors={issues.map((i) => i.line)} />
    </section>
  );
}

export function Problems({ issues }: { issues: Issue[] }) {
  return (
    <section className="dc-panel dc-panel--problems" aria-label="Problems">
      <h2 className="dc-panel__h">
        <Warn /> {issues.length} {issues.length === 1 ? "problem" : "problems"} to fix
      </h2>
      <ol className="dc-issues">
        {issues.map((i) => (
          <li key={i.field}>
            <span className="dc-issues__line">Line {i.line}</span>
            <b>{i.message}</b>
            <span>{i.fix}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Checks({ checks }: { checks: Passed[] }) {
  return (
    <section className="dc-panel" aria-label="Checks">
      <h2 className="dc-panel__h dc-panel__h--ok">
        <Check size={18} /> Ready to preview · {checks.length} checks passed
      </h2>
      <ul className="dc-checks">
        {checks.map((c) => (
          <li key={c.label}>
            <Check size={16} />
            <b>{c.label}</b>
            <span>{c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Previews({ gameId, dim = false, children }: { gameId: string; dim?: boolean; children?: ReactNode }) {
  const g = gameById(gameId);
  const plan = seatPlan(g, HOME.people.filter((p) => p.id !== "mom"));
  return (
    <section className={`dc-preview ${dim ? "is-dim" : ""}`} aria-label="Preview" aria-hidden={dim || undefined}>
      <div className="dc-preview__tv">
        <span className="dc-label">On the TV</span>
        <div className="dc-tv">
          <img src={g.art.tv} alt="" />
        </div>
      </div>
      <div className="dc-preview__side">
        <span className="dc-label">In the library</span>
        <div className="dc-phone-tile">
          <Tile gameId={gameId} tier={0} />
        </div>
        <span className="dc-label">Seats, by audience</span>
        <ul className="dc-seats">
          {plan.map((a) => (
            <li key={a.person.id}>
              <Portrait person={a.person} size={26} ring={false} />
              <span>
                {a.person.name} · <b>{a.role.label}</b>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {children}
    </section>
  );
}

export function TvButton({ label, onClick, bot }: { label: string; onClick: () => void; bot: string }) {
  return (
    <button className="dv-btn dv-btn--ghost" data-bot={bot} onClick={onClick}>
      <TvIcon size={18} />
      {label}
    </button>
  );
}
