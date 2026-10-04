/** "The Mumms' living room", "Our family's living room". */
export function roomName(household: string): string {
  const name = household.trim();
  return `${name}${/s$/i.test(name) ? "'" : "'s"} living room`;
}
