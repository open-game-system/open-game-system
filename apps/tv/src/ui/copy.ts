/** "Living room TV · Jonathan's games": the TV, and whose library it shows. */
export function roomTitle(tvName: string, hostName: string): string {
  const host = hostName.trim();
  return `${tvName.trim()} · ${host}${/s$/i.test(host) ? "'" : "'s"} games`;
}
