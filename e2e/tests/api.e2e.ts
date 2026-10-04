// Identity and household rules at the API boundary (no screen, no model).
import { describe, expect, test } from "e2e";
import { api, household } from "./household";

describe("API identity", { tags: ["api"], requires: ["browser"] }, () => {
  test("a launcher token can read the library but cannot change it", async () => {
    const hh = await household();
    const read = await api(`/api/v1/households/${hh.hid}/library`, { token: hh.launcherToken });
    expect(read.status).toBe(200);
    const write = await api(`/api/v1/households/${hh.hid}/library`, { method: "PUT", body: { appIds: ["rocket-crew"] }, token: hh.launcherToken });
    expect(write.status).toBe(403);
    expect((write.json.error as { code: string }).code).toBe("phone_required");
  });

  test("another household's token is refused", async () => {
    const a = await household();
    const b = await household();
    const res = await api(`/api/v1/households/${a.hid}/instances`, { token: b.phoneToken });
    expect(res.status).toBe(403);
    expect((res.json.error as { code: string }).code).toBe("forbidden_household");
  });

  test("no token is refused with the error contract", async () => {
    const hh = await household();
    const res = await api(`/api/v1/households/${hh.hid}/instances`);
    expect(res.status).toBe(401);
    expect(res.json.error).toMatchObject({ code: "missing_auth", status: 401 });
  });
});
