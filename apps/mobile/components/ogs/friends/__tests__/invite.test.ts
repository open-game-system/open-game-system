import { inviteMessage } from "../invite";

describe("invite message", () => {
  it("names you in the message that goes with the link", () => {
    expect(inviteMessage("Jonathan", "https://opengame.org/add/p1")).toBe(
      "Jonathan wants to be friends on OGS: https://opengame.org/add/p1",
    );
  });
});
