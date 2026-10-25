import type { RenderTier } from "@open-game-system/ogs-protocol";

export interface ReceiverView {
  /** What the receiver's frame loads. */
  url: string;
  /** The OGS launcher (served from the receiver's own site), not another page. */
  launcher: boolean;
  /** The host the sender named (logged instead of the URL: its query carries the launcher token). */
  host: string;
  /** The launcher's OGS API (its api= param): where the receiver's client log goes. */
  api: string | null;
}

function parse(url: string): URL | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * The page the receiver frames for a sender's LOAD_VIEW. An OGS launcher URL (`/?api=…&token=…`, as
 * the phone sends for every cast, ADR 2026-10-23) is served from the receiver's own site: the
 * receiver and the launcher are one deploy (apps/tv), so they always speak the same protocol, and a
 * dev phone's localhost launcher still loads on the TV (`fake=1`, the launcher's fake couch, too). Its query is kept (token, api, chrome=none,
 * app) and `tier` is set to what this TV measured. Any other page is framed as it is.
 */
export function receiverView(
  viewUrl: string,
  receiverOrigin: string,
  tier: RenderTier,
): ReceiverView | null {
  const u = parse(viewUrl);
  if (!u) return null;
  const q = u.searchParams;
  const atRoot = u.pathname === "/" || u.pathname === "/index.html";
  const isLauncher = atRoot && ((q.has("api") && q.has("token")) || q.get("fake") === "1");
  if (!isLauncher) return { url: viewUrl, launcher: false, host: u.host, api: null };
  const next = new URLSearchParams(q);
  next.set("tier", tier);
  const api = parse(q.get("api") ?? "");
  return {
    url: `${receiverOrigin}/?${next.toString()}`,
    launcher: true,
    host: u.host,
    api: api ? api.origin : null,
  };
}
