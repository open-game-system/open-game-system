/** Bytes as unpadded base64url (RFC 4648 §5): `+` → `-`, `/` → `_`, no `=`. */
export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
