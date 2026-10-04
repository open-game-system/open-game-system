import type { Identity } from "../../../../services/identity";
import { backupView, greeting, profileReturnKey, profileView } from "../profile-view";

const identity: Identity = {
  profile: { id: "pr1", handle: "jonathan.m", name: "Jonathan", sticker: "bear" },
  deviceId: "d1",
  deviceToken: "t",
};

describe("profileView (the Profile tab's card)", () => {
  it("is empty before this device has a profile", () => {
    expect(profileView(null)).toBeNull();
  });

  it("shows the sticker, the name and the @id", () => {
    expect(profileView(identity)).toEqual({
      id: "pr1",
      name: "Jonathan",
      handle: "@jonathan.m",
      sticker: "bear",
    });
  });
});

describe("backupView", () => {
  it("not backed up: says so and offers Back up", () => {
    expect(backupView([])).toEqual({ backedUp: false, label: "Not backed up" });
  });

  it("backed up with one login names its provider", () => {
    expect(backupView([{ provider: "google", email: "j@x.org" }])).toEqual({
      backedUp: true,
      label: "Backed up with Google",
    });
    expect(backupView([{ provider: "apple", email: null }]).label).toBe("Backed up with Apple");
    expect(backupView([{ provider: "email", email: "j@x.org" }]).label).toBe(
      "Backed up with email",
    );
  });

  it("several logins are all named", () => {
    expect(
      backupView([
        { provider: "apple", email: null },
        { provider: "email", email: "j@x.org" },
      ]).label,
    ).toBe("Backed up with Apple and email");
  });
});

describe("greeting (onboarding's done page)", () => {
  it("greets by first name", () => {
    expect(greeting("Jonathan Mumm")).toBe("Hi, Jonathan");
    expect(greeting("  Juneau ")).toBe("Hi, Juneau");
  });
});

describe("profileReturnKey (the keyboard's return key on the profile fields)", () => {
  it("on the name it says Next and moves to the @id", () => {
    expect(profileReturnKey("name", true)).toEqual({
      returnKeyType: "next",
      action: "focusHandle",
    });
    expect(profileReturnKey("name", false)).toEqual({
      returnKeyType: "next",
      action: "focusHandle",
    });
  });

  it("on the @id it says Done and submits the profile once it can be submitted", () => {
    expect(profileReturnKey("handle", true)).toEqual({ returnKeyType: "done", action: "submit" });
  });

  it("on the @id it only closes the keyboard while the profile cannot be submitted", () => {
    expect(profileReturnKey("handle", false)).toEqual({ returnKeyType: "done", action: "dismiss" });
  });
});
