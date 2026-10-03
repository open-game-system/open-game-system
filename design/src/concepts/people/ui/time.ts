import { NOW } from "../../../world";

/** "7:02", "Wed", "Sep 21": how a messages list says when. */
export function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((NOW.getTime() - d.getTime()) / 86_400_000);
  const sameDay = d.toDateString() === NOW.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(/\s?[AP]M$/, "");
  if (days < 6) return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Los_Angeles" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
}
