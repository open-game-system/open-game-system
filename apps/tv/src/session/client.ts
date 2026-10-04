import type { ClientMessage, SessionState } from "@open-game-system/ogs-protocol";
import type { Dir } from "../launcher/focus-grid";

/** connecting: never had state yet; reconnecting: lost the socket but keeps the last state. */
export type Connection = "connecting" | "open" | "reconnecting";

export interface SessionSnapshot {
  state: SessionState | null;
  connection: Connection;
}

/** What the launcher UI needs from a couch session, live (WebSocket) or fake (in-memory). */
export interface SessionClient {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionSnapshot;
  send(msg: ClientMessage): void;
  onFocusMove(listener: (dir: Dir) => void): () => void;
  close(): void;
}

/** Shared listener plumbing for both clients. */
export class Emitter<T> {
  private listeners = new Set<(v: T) => void>();
  on(fn: (v: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(v: T): void {
    for (const fn of this.listeners) fn(v);
  }
}
