import { createEmulator, type Emulator } from "emulate";
import { EMULATED, PEOPLE } from "./emulators";

const port = (url: string) => Number(new URL(url).port);

/** Starts the Apple, Google and Resend emulators for the integration run. */
export default async function setup() {
  const users = PEOPLE.map((email) => ({ email, name: email.split("@")[0] }));
  const seed = { google: { users }, apple: { users } };
  const running: Emulator[] = await Promise.all([
    createEmulator({ service: "google", port: port(EMULATED.google), seed }),
    createEmulator({ service: "apple", port: port(EMULATED.apple), seed }),
    createEmulator({ service: "resend", port: port(EMULATED.resend) }),
  ]);
  return async () => {
    await Promise.all(running.map((e) => e.close()));
  };
}
