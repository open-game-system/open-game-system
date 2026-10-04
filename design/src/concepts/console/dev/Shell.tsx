// The developer site's frame: the OGS ring, Docs | Console, and the docs' left nav.
import type { ReactNode } from "react";
import { HOME, person } from "../../../world";
import { Mark } from "../ui/Brand";
import { Sticker, StickerRow } from "../ui/Sticker";
import { NAV, isConsole, type DevPage } from "./pages";

export function TierChip({ tier, size = "md" }: { tier: 0 | 1 | 2; size?: "sm" | "md" }) {
  return (
    <span className={`dv-tier dv-tier--${tier} dv-tier--${size}`}>
      <TierGlyph tier={tier} />
      Tier {tier}
    </span>
  );
}

/** Tier glyph: an outlined dot (listed), a filled dot (remembers), a filled dot with a live ring. */
export function TierGlyph({ tier }: { tier: 0 | 1 | 2 }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="dv-tierglyph">
      {tier === 0 && <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {tier >= 1 && <circle cx="6" cy="6" r={tier === 2 ? 3 : 4} fill="currentColor" />}
      {tier === 2 && <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />}
    </svg>
  );
}

function Top({ page, go }: { page: DevPage; go: (p: DevPage) => void }) {
  const inConsole = isConsole(page);
  return (
    <header className="dv-top">
      <span className="dv-brand">
        <Mark size={24} />
        <b>OGS</b>
        <span>Developers</span>
      </span>
      <nav className="dv-top__tabs" aria-label="Developer site">
        <button className={!inConsole ? "is-on" : ""} data-bot="dev-docs" onClick={() => go("overview")} aria-current={!inConsole ? "page" : undefined}>
          Docs
        </button>
        <button className={inConsole ? "is-on" : ""} data-bot="dev-console" onClick={() => go("console-live")} aria-current={inConsole ? "page" : undefined}>
          Console
        </button>
      </nav>
      <span className="dv-top__right">
        <span className="dv-top__ver">API v1</span>
        <span className="dv-acct">
          <Sticker person={person("dad")} size={32} />
          Jonathan Mumm
        </span>
      </span>
    </header>
  );
}

export function Shell({ page, go, children }: { page: DevPage; go: (p: DevPage) => void; children: ReactNode }) {
  return (
    <div className="dv">
      <Top page={page} go={go} />
      <div className={`dv-body ${isConsole(page) ? "dv-body--console" : ""}`}>
        {!isConsole(page) && (
          <nav className="dv-nav" aria-label="Docs">
            {NAV.map((g) => (
              <div key={g.group} className={`dv-nav__group ${g.group === "Tiers" ? "dv-nav__group--path" : ""}`}>
                <h3 className="dv-nav__h">{g.group}</h3>
                {g.items.map((it) => (
                  <button key={it.page} className={`dv-nav__item ${it.page === page ? "is-on" : ""}`} data-bot={`nav-${it.page}`} onClick={() => go(it.page)} aria-current={it.page === page ? "page" : undefined}>
                    {it.tier !== undefined && (
                      <span className="dv-nav__stop">
                        <TierGlyph tier={it.tier} />
                      </span>
                    )}
                    <span className="dv-nav__label">{it.label}</span>
                    {it.tier !== undefined && <span className="dv-nav__n">T{it.tier}</span>}
                  </button>
                ))}
              </div>
            ))}
            <div className="dv-nav__foot">
              <span className="dv-nav__family">
                <StickerRow people={HOME.people} size={30} />
              </span>
              <span className="dv-nav__foottext">Every example: the Mumms, Friday 7:10 pm.</span>
              <span className="dv-nav__legend">
                <span className="dv-new">New</span>
                <span>beyond today's spec</span>
              </span>
            </div>
          </nav>
        )}
        <main className="dv-main">{children}</main>
      </div>
    </div>
  );
}
