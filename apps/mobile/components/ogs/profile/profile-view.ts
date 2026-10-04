import type { Identity } from "../../../services/identity";
import type { Login, Provider } from "../../../services/ogs-api";

export interface ProfileCardView {
  id: string;
  name: string;
  /** The @id as shown, with its "@". */
  handle: string;
  sticker: string;
}

/** The Profile tab's card: this device's profile (spec ogs-profiles, 2 · Profile tab). */
export function profileView(identity: Identity | null): ProfileCardView | null {
  if (!identity) return null;
  const { id, name, handle, sticker } = identity.profile;
  return { id, name, handle: `@${handle}`, sticker };
}

const PROVIDER_LABEL: Record<Provider, string> = {
  apple: "Apple",
  google: "Google",
  email: "email",
};

/** "Not backed up" (with Back up) or "Backed up with Google". */
export function backupView(logins: Login[]): { backedUp: boolean; label: string } {
  if (logins.length === 0) return { backedUp: false, label: "Not backed up" };
  const names = logins.map((l) => PROVIDER_LABEL[l.provider]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { backedUp: true, label: `Backed up with ${list}` };
}

/** "Hi, Jonathan": the done page greets by first name. */
export function greeting(name: string): string {
  return `Hi, ${name.trim().split(/\s+/)[0] ?? name}`;
}

export type ProfileField = "name" | "handle";

/**
 * The keyboard's return key on the profile fields: on the name it moves to the @id; on the @id it
 * submits once the profile can be (otherwise it only closes the keyboard).
 */
export function profileReturnKey(
  field: ProfileField,
  canSubmit: boolean,
): { returnKeyType: "next" | "done"; action: "focusHandle" | "submit" | "dismiss" } {
  if (field === "name") return { returnKeyType: "next", action: "focusHandle" };
  return { returnKeyType: "done", action: canSubmit ? "submit" : "dismiss" };
}
