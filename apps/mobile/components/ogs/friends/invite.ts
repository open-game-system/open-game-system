/** The message that goes with a shared invite link (Add a friend → Share invite link). */
export function inviteMessage(name: string, link: string): string {
  return `${name} wants to be friends on OGS: ${link}`;
}
