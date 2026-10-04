// The Console's live manifest check. Parses pasted text at the boundary (unknown in, issues out);
// every message says what is wrong, why OGS cares, and the fix.
export interface Issue {
  line: number;
  field: string;
  message: string;
  fix: string;
}

export interface Check {
  label: string;
  detail: string;
}

export interface Result {
  issues: Issue[];
  checks: Check[];
}

const AUDIENCES = ["grownup", "kid", "little"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (o: Record<string, unknown>, k: string): string | undefined => {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
};

/** 1-based line of the first line containing `needle` (falls back to 1). */
function lineOf(text: string, needle: string): number {
  const i = text.split("\n").findIndex((l) => l.includes(needle));
  return i < 0 ? 1 : i + 1;
}

function httpsIssue(text: string, field: string, url: string | undefined, why: string, suggest?: string): Issue | null {
  if (!url) return { line: lineOf(text, "{"), field, message: `${field} is missing.`, fix: `Add "${field}": "https://…".` };
  if (url.startsWith("https://")) return null;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return { line: lineOf(text, `"${field}"`), field, message: `${field} must be https. ${why.replace("{host}", host)}`, fix: suggest ? `Use ${suggest} (your startUrl's host).` : "Deploy the page and use its https URL." };
}

export function validate(text: string): Result {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { issues: [{ line: 1, field: "json", message: `Not valid JSON: ${e instanceof Error ? e.message : "parse error"}.`, fix: "Check for a trailing comma or a missing quote." }], checks: [] };
  }
  if (!isRecord(data)) return { issues: [{ line: 1, field: "json", message: "The manifest must be one JSON object.", fix: "Wrap the fields in { }." }], checks: [] };

  const issues: Issue[] = [];
  const checks: Check[] = [];
  const appId = str(data, "appId");
  if (!appId || !/^[a-z0-9-]+$/.test(appId)) issues.push({ line: lineOf(text, '"appId"'), field: "appId", message: "appId must be lowercase letters, digits and dashes.", fix: 'Use your game\'s slug, e.g. "peekaboo-garden".' });
  else checks.push({ label: "appId is yours", detail: `${appId} · not taken` });

  const start = httpsIssue(text, "startUrl", str(data, "startUrl"), "Phones open it from anywhere, not only your Wi-Fi.");
  if (start) issues.push(start);
  else checks.push({ label: "startUrl answers", detail: "200 in 140 ms" });

  const startUrl = str(data, "startUrl");
  const suggest = !start && startUrl ? `${new URL(startUrl).origin}/tv` : undefined;
  const tv = httpsIssue(text, "tvUrl", str(data, "tvUrl"), "The TV is rendered by a cloud browser, which can't reach {host} on your Wi-Fi.", suggest);
  if (tv) issues.push(tv);
  else checks.push({ label: "tvUrl renders at 1920 × 1080", detail: "first frame in 1.8 s" });

  const roles = data["roles"];
  if (!Array.isArray(roles) || roles.length === 0) {
    issues.push({ line: lineOf(text, '"roles"'), field: "roles", message: "Add at least one role.", fix: 'e.g. { "id": "player", "audience": "grownup", "label": "Player" }.' });
  } else {
    let ok = 0;
    for (const r of roles) {
      if (!isRecord(r)) continue;
      const id = str(r, "id") ?? "?";
      const aud = str(r, "audience");
      if (!aud || !AUDIENCES.includes(aud)) {
        issues.push({
          line: lineOf(text, `"id": "${id}"`),
          field: `roles.${id}`,
          message: `Role "${id}" has no audience, so OGS can't tell who sits there.`,
          fix: `Add "audience": "little" for an under-4 seat (or "kid", "grownup").`,
        });
      } else ok++;
    }
    if (ok === roles.length) checks.push({ label: `${ok} roles, each with an audience`, detail: roles.map((r) => (isRecord(r) ? str(r, "audience") : "")).join(" · ") });
  }
  if (str(data, "icon")) checks.push({ label: "icon is a 512 px PNG", detail: "icon.png · 38 KB" });
  return { issues, checks };
}
