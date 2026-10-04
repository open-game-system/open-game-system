import { inviteLink, inviteMessage } from "../invite";

describe("invite link (pending the profiles backend)", () => {
  it("points at opengame.org/add/<person id>", () => {
    expect(inviteLink("p-123")).toBe("https://opengame.org/add/p-123");
  });

  it("escapes ids so the link stays one path segment", () => {
    expect(inviteLink("a b/c")).toBe("https://opengame.org/add/a%20b%2Fc");
  });

  it("has no link without a person id", () => {
    expect(inviteLink(null)).toBeNull();
    expect(inviteLink("")).toBeNull();
  });

  it("names you in the message that goes with the link", () => {
    expect(inviteMessage("Jonathan", "https://opengame.org/add/p1")).toBe(
      "Jonathan wants to be friends on OGS: https://opengame.org/add/p1",
    );
  });
});
