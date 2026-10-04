import { Hono } from "hono";
import { z } from "zod";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { issueToken, LAUNCHER_TOKEN_TTL_S, PHONE_TOKEN_TTL_S } from "../lib/identity";
import { type HouseholdEnv, phoneOnly } from "../middleware/household-auth";

const BandSchema = z.enum(["grownup", "kid", "little"]);
const NewPersonSchema = z.object({
  name: z.string().trim().min(1).max(60),
  band: BandSchema,
  sticker: z.string().min(1).max(60),
});
const DeviceIdSchema = z.string().min(1).max(128);
const DeviceNameSchema = z.string().trim().min(1).max(60);

const CreateHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(60),
  people: z.array(NewPersonSchema).min(1).max(12),
  device: z.object({
    deviceId: DeviceIdSchema,
    kind: z.literal("phone"),
    name: DeviceNameSchema,
    personIndex: z.number().int().min(0).optional(),
  }),
});

const PairDeviceSchema = z.object({
  deviceId: DeviceIdSchema,
  kind: z.enum(["phone", "tablet"]),
  personId: z.string().min(1).optional(),
  name: DeviceNameSchema,
});

const PersonRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  band: BandSchema,
  sticker: z.string(),
});
const DeviceRowSchema = z.object({
  device_id: z.string(),
  kind: z.enum(["phone", "tablet", "launcher"]),
  person_id: z.string().nullable(),
  name: z.string(),
});
const HouseholdRowSchema = z.object({ id: z.string(), name: z.string() });

/** Mounted at /api/v1/households; every `/:hid` route sits behind householdAuth (index.ts). */
const households = new Hono<HouseholdEnv>();

/** POST /api/v1/households — create a household, its people, and a token for the creating phone. */
households.post("/", async (c) => {
  const body = await parseBody(c, CreateHouseholdSchema);
  if (!body)
    return invalidBody(c, "name, people[] and device { deviceId, kind: phone, name } are required");
  const { personIndex } = body.device;
  if (personIndex !== undefined && personIndex >= body.people.length)
    return apiError(c, 400, "unknown_person", "personIndex does not name a person in people[]");

  const householdId = crypto.randomUUID();
  const people = body.people.map((p) => ({ id: crypto.randomUUID(), ...p }));
  const personId = personIndex === undefined ? undefined : people[personIndex].id;
  const db = c.env.DB;
  await db.batch([
    db.prepare("INSERT INTO households (id, name) VALUES (?, ?)").bind(householdId, body.name),
    ...people.map((p) =>
      db
        .prepare(
          "INSERT INTO household_people (id, household_id, name, band, sticker) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(p.id, householdId, p.name, p.band, p.sticker),
    ),
    upsertDevice(
      db,
      householdId,
      body.device.deviceId,
      "phone",
      personId ?? null,
      body.device.name,
    ),
  ]);

  const token = await issueToken(
    { hid: householdId, did: body.device.deviceId, pid: personId, kind: "phone" },
    c.env.OGS_JWT_SECRET,
    { now: Date.now(), ttlSeconds: PHONE_TOKEN_TTL_S },
  );
  return c.json({ householdId, people, token }, 201);
});

/** GET /api/v1/households/:hid — the household, its people and devices. */
households.get("/:hid", async (c) => {
  const hid = c.get("claims").hid;
  const db = c.env.DB;
  const [household, people, devices] = await Promise.all([
    db.prepare("SELECT id, name FROM households WHERE id = ?").bind(hid).first(),
    db
      .prepare(
        "SELECT id, name, band, sticker FROM household_people WHERE household_id = ? ORDER BY rowid",
      )
      .bind(hid)
      .all(),
    db
      .prepare(
        "SELECT device_id, kind, person_id, name FROM household_devices WHERE household_id = ? ORDER BY rowid",
      )
      .bind(hid)
      .all(),
  ]);
  const { id, name } = HouseholdRowSchema.parse(household);
  return c.json({
    id,
    name,
    people: z.array(PersonRowSchema).parse(people.results),
    devices: z
      .array(DeviceRowSchema)
      .parse(devices.results)
      .map((d) => ({ deviceId: d.device_id, kind: d.kind, personId: d.person_id, name: d.name })),
  });
});

/** POST /api/v1/households/:hid/devices — a household phone pairs a tablet or another phone. */
households.post("/:hid/devices", phoneOnly, async (c) => {
  const hid = c.get("claims").hid;
  const body = await parseBody(c, PairDeviceSchema);
  if (!body) return invalidBody(c, "deviceId, kind (phone|tablet) and name are required");
  if (body.personId) {
    const person = await c.env.DB.prepare(
      "SELECT 1 AS one FROM household_people WHERE id = ? AND household_id = ?",
    )
      .bind(body.personId, hid)
      .first();
    if (!person) return apiError(c, 400, "unknown_person", "personId is not in this household");
  }
  await upsertDevice(
    c.env.DB,
    hid,
    body.deviceId,
    body.kind,
    body.personId ?? null,
    body.name,
  ).run();
  const token = await issueToken(
    { hid, did: body.deviceId, pid: body.personId, kind: body.kind },
    c.env.OGS_JWT_SECRET,
    { now: Date.now(), ttlSeconds: PHONE_TOKEN_TTL_S },
  );
  return c.json({ token }, 201);
});

/** POST /api/v1/households/:hid/launcher-token — a short-lived token for the TV launcher. */
households.post("/:hid/launcher-token", phoneOnly, async (c) => {
  const hid = c.get("claims").hid;
  const token = await issueToken(
    { hid, did: `launcher-${crypto.randomUUID()}`, kind: "launcher" },
    c.env.OGS_JWT_SECRET,
    { now: Date.now(), ttlSeconds: LAUNCHER_TOKEN_TTL_S },
  );
  return c.json({ token }, 201);
});

function upsertDevice(
  db: D1Database,
  householdId: string,
  deviceId: string,
  kind: "phone" | "tablet",
  personId: string | null,
  name: string,
) {
  return db
    .prepare(
      `INSERT INTO household_devices (device_id, household_id, kind, person_id, name)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         household_id = excluded.household_id,
         kind = excluded.kind,
         person_id = excluded.person_id,
         name = excluded.name`,
    )
    .bind(deviceId, householdId, kind, personId, name);
}

export default households;
