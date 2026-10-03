// The phone's status bar and the station bar: the channel's name and tonight's clock, always.
import type { ReactNode } from "react";
import { Wordmark } from "./Mark";

export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`ch-status${dark ? " is-dark" : ""}`} aria-hidden="true">
      <span>7:10</span>
      <span className="ch-status-icons">
        <i className="sig" />
        <i className="bat" />
      </span>
    </div>
  );
}

export function StationBar({ right }: { right?: ReactNode }) {
  return (
    <header className="ch-station">
      <Wordmark size={21} />
      <span className="ch-station-right">{right ?? <span className="ch-clock">Fri 7:10 pm</span>}</span>
    </header>
  );
}
