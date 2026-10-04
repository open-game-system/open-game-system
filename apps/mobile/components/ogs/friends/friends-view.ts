import type { CastingFriend, Friend, Presence } from "@open-game-system/ogs-protocol";
import qrcode from "qrcode-generator";

/** A friend's presence in words; offline says nothing (the @id stands alone). */
export function presenceLabel(p: Presence): string | null {
  switch (p.kind) {
    case "casting":
      return p.game ? `Casting ${p.game.name} on ${p.tvName}` : `Casting on ${p.tvName}`;
    case "playing":
      return `Playing ${p.game.name}`;
    case "online":
      return "Online";
    case "offline":
      return null;
  }
}

/** The line under a friend's name: "@mom.m · Online". */
export function subtitleOf(f: Friend): string {
  const label = presenceLabel(f.presence);
  return label ? `@${f.handle} · ${label}` : `@${f.handle}`;
}

/** The Join cards to show: every friend's live cast but the one this device is on. */
export const joinCards = (casts: readonly CastingFriend[], mySessionId: string | null) =>
  casts.filter((c) => c.sessionId !== mySessionId);

export function castCardLines(c: CastingFriend): { title: string; detail: string } {
  return {
    title: `${c.host.name} is casting on ${c.tvName}`,
    detail: c.game ? `Playing ${c.game.name}` : `${c.host.name}'s games`,
  };
}

export interface QrRun {
  x: number;
  y: number;
  w: number;
}

/** The QR code for `text` (error correction M) as horizontal runs of dark modules, row by row. */
export function qrRuns(text: string): { size: number; rows: QrRun[][] } {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const rows: QrRun[][] = [];
  for (let y = 0; y < size; y++) {
    const row: QrRun[] = [];
    let x = 0;
    while (x < size) {
      if (!qr.isDark(y, x)) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && qr.isDark(y, x)) x++;
      row.push({ x: start, y, w: x - start });
    }
    rows.push(row);
  }
  return { size, rows };
}
