/**
 * The link "Share my profile" sends.
 * TODO(profiles backend): the format is provisional. It carries the profile id; once /friends
 * (invite, accept) exists it becomes that endpoint's invite (handle or invite code), and
 * opengame.org/add/<id> must resolve it (open the app, or the App Store).
 */
export function inviteLink(profileId: string | null): string | null {
  if (!profileId) return null;
  return `https://opengame.org/add/${encodeURIComponent(profileId)}`;
}

export function inviteMessage(name: string, link: string): string {
  return `${name} wants to be friends on OGS: ${link}`;
}
