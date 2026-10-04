import { z } from "zod";
import { type Band, PersonSchema } from "./ogs-api";

/** This phone's place in a household: who it belongs to and the token that proves it. */
export const IdentitySchema = z.object({
  householdId: z.string().min(1),
  deviceId: z.string().min(1),
  token: z.string().min(1),
  householdName: z.string(),
  people: z.array(PersonSchema),
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

/** Sensible defaults for "who's in your family", edited in one short onboarding step. */
export const DEFAULT_FAMILY: { name: string; band: Band; sticker: StickerId }[] = [
  { name: "Me", band: "grownup", sticker: "bear" },
  { name: "Big kid", band: "kid", sticker: "dragon" },
  { name: "Little one", band: "little", sticker: "dinosaur" },
];
