/**
 * The link "Share my profile" sends.
 * TODO(profiles backend): the format is provisional. Today it carries the household person id;
 * once POST /profiles and /friends exist it becomes the profile's invite (handle or invite code),
 * and opengame.org/add/<id> must resolve it (open the app, or the App Store).
 */
export function inviteLink(personId: string | null): string | null {
  if (!personId) return null;
  return `https://opengame.org/add/${encodeURIComponent(personId)}`;
}

export function inviteMessage(name: string, link: string): string {
  return `${name} wants to be friends on OGS: ${link}`;
}
