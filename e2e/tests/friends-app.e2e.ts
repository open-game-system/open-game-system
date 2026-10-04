// Friends in the OGS app on one simulator; Mom is a second profile made through the API (OGS_API,
// the API the app was built against). Acceptance: docs/acceptance/2026-10-04-ogs-friends.feature.
import { describe, expect, test } from "e2e";
import { z } from "zod";
import { api, profile } from "./profile";

const Incoming = z.object({ incoming: z.array(z.object({ id: z.string() })) });

describe("OGS app, friends", { tags: ["ios"], serial: true, requires: ["native-app"] }, () => {
  test("Add a friend: Mom types my code, I accept, she is in Friends", async ({ app, screen }) => {
    await app.clearState();
    await app.open();
    await screen.getByTestId("onboardingSkipButton").tap();
    await screen.getByTestId("profileNameInput").fill("Tester");
    await expect(screen.getByTestId("profileHandleStatus")).toHaveText("free", { timeout: 10_000 });
    // Return closes the keyboard, which otherwise sits over Next.
    await screen.getByTestId("profileNameInput").press("Enter");
    await screen.getByTestId("profileNext").tap();
    await expect(screen.getByTestId("onboardingLetsGoButton")).toBeVisible({ timeout: 10_000 });
    await screen.getByTestId("onboardingLetsGoButton").tap();
    await screen.getByTestId("tabFriends").tap();
    await expect(screen.getByTestId("addFriend")).toBeVisible({ timeout: 10_000 });
    await screen.getByTestId("addFriend").tap();
    await expect(screen.getByTestId("inviteCode")).toHaveText(/^[A-Z]{4}-[2-9]{2}$/, {
      timeout: 10_000,
    });
    await app.screenshot("add-a-friend");
    const code = await screen.getByTestId("inviteCode").textContent();
    const mom = await profile("Mom", "owl");
    expect(
      (await api("/api/v1/friends/invites/redeem", { body: { code }, token: mom.token })).status,
    ).toBe(201);
    await screen.getByTestId("addFriendClose").tap();
    await screen.getByTestId("tabProfile").tap();
    await screen.getByTestId("tabFriends").tap();
    await expect(screen.getByTestId(`accept-${mom.handle}`)).toBeVisible({ timeout: 10_000 });
    await app.screenshot("friend-request");
    await screen.getByTestId(`accept-${mom.handle}`).tap();
    await expect(screen.getByTestId(`friend-${mom.handle}`)).toBeVisible({ timeout: 10_000 });
    await app.screenshot("friends-list");
    // Mom's side agrees: no requests left, one friend.
    const left = Incoming.parse((await api("/api/v1/friends/requests", { token: mom.token })).json);
    expect(left.incoming).toHaveLength(0);
  });
});
