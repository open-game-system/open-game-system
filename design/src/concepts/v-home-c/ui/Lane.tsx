// A home lane: its name, an optional count, an optional action. The three lanes (On the TV
// tonight · Your turn · Game nights) are the phone's whole model, so their names never change.
import type { ReactNode } from "react";

export function Lane({ title, count, action, children, id }: { title: string; count?: number; action?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section className={`cx-lane cx-lane--${id}`} aria-label={title}>
      <header className="cx-lane__head">
        <h2>
          {title}
          {count !== undefined && count > 0 && (
            <span key={count} className="cx-lane__count">
              {count}
            </span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
