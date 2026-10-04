import { z } from "zod";
import { ProfileSchema } from "./ogs-api";

/**
 * This device's one active profile and the token that proves it (one profile per device for now;
 * switching profiles later swaps this whole value).
 */
export const IdentitySchema = z.object({
  profile: ProfileSchema,
  deviceId: z.string().min(1),
  deviceToken: z.string().min(1),
});
export type Identity = z.infer<typeof IdentitySchema>;

/** The slice of expo-secure-store this needs. */
export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const KEY = "ogs.identity";

export async function loadIdentity(storage: SecureStorage): Promise<Identity | null> {
  const raw = await storage.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = IdentitySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveIdentity(storage: SecureStorage, identity: Identity): Promise<void> {
  await storage.setItemAsync(KEY, JSON.stringify(identity));
}

export async function clearIdentity(storage: SecureStorage): Promise<void> {
  await storage.deleteItemAsync(KEY);
}

/** The Story Nook characters people pick as their sticker (no initials anywhere). */
export const STICKERS = [
  { id: "bear", label: "Bear" },
  { id: "owl", label: "Owl" },
  { id: "dragon", label: "Dragon" },
  { id: "dinosaur", label: "Dinosaur" },
  { id: "turtle", label: "Turtle" },
  { id: "whale", label: "Whale" },
  { id: "firefly", label: "Firefly" },
  { id: "mouse", label: "Mouse" },
  { id: "cloud", label: "Cloud" },
] as const;
export type StickerId = (typeof STICKERS)[number]["id"];
