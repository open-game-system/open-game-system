// Status chip: the one status vocabulary (status.ts), drawn the same everywhere. Each kind has its
// own glyph, so colour never carries the meaning alone.
import type { ReactNode } from "react";
import type { Status, StatusKind } from "../status";

function G({ children }: { children: ReactNode }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      {children}
    </svg>
  );
}

function Glyph({ kind }: { kind: StatusKind }) {
  switch (kind) {
    case "live":
      return (
        <G>
          <circle cx="6" cy="6" r="3.4" fill="currentColor" />
        </G>
      );
    case "yours":
      // The OGS ring with its core: "you".
      return (
        <G>
          <path d="M6 1.4a4.6 4.6 0 1 1-4 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="6" cy="6" r="1.9" fill="currentColor" />
        </G>
      );
    case "theirs":
      return (
        <G>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </G>
      );
    case "invited":
      return (
        <G>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="1.6 1.8" />
        </G>
      );
    case "tonight":
      return (
        <G>
          <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 3.4V6l1.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </G>
      );
    case "paused":
      return (
        <G>
          <rect x="2.6" y="2.2" width="2.3" height="7.6" rx=".8" fill="currentColor" />
          <rect x="7.1" y="2.2" width="2.3" height="7.6" rx=".8" fill="currentColor" />
        </G>
      );
    case "ready":
      return (
        <G>
          <path d="M3.4 2.2l6.2 3.8-6.2 3.8z" fill="currentColor" />
        </G>
      );
    case "done":
      return (
        <G>
          <path d="M2.2 6.4l2.4 2.4 5.2-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case "closed":
      return (
        <G>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.2 8.8l5.6-5.6" stroke="currentColor" strokeWidth="1.5" />
        </G>
      );
  }
}

export function Chip({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={`cx-chip cx-chip--${status.kind} ${className ?? ""}`}>
      <Glyph kind={status.kind} />
      <span>{status.label}</span>
    </span>
  );
}
