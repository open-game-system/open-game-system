/** A profile's @id: lowercase letters, digits, dots and underscores, 2–24 long, starting alnum. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._]{1,23}$/;
const MAX = 24;

/** What someone typed ("@Jonny") as a handle candidate ("jonny"); not yet validated. */
export function normaliseHandle(typed: string): string {
  return typed.trim().replace(/^@+/, "").toLowerCase();
}

export const isValidHandle = (handle: string): boolean => HANDLE_PATTERN.test(handle);

const word = (w: string) =>
  w
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** The pre-filled @id: "Jonathan Mumm" → "jonathan.m", "Juneau" → "juneau". */
export function handleFromName(name: string): string {
  const words = name.split(/\s+/).map(word).filter(Boolean);
  if (words.length === 0) return "player";
  const first = words[0].slice(0, MAX);
  const last = words.length > 1 ? words[words.length - 1] : "";
  const base = last ? `${first.slice(0, MAX - 2)}.${last[0]}` : first;
  return base.length < 2 ? `${base}1` : base;
}

/** Candidates after a taken handle: jonathan.m2, jonathan.m3, … (kept within the length limit). */
export function nextCandidates(handle: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 2);
    return `${handle.slice(0, MAX - n.length)}${n}`;
  });
}
