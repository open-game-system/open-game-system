import { act, create, type ReactTestInstance } from "react-test-renderer";
import { createAirplaySheet } from "../airplay-sheet";
import { AirplaySheetHost, AirplaySteps, ShowOnTvSheet } from "../ShowOnTvSheet";

// docs/acceptance/2026-10-23-airplay-display.feature, "Show on TV with an Apple TV".
const texts = (root: ReactTestInstance) =>
  root
    .findAll((n) => String(n.type) === "Text")
    .map((n) => n.children.filter((c) => typeof c === "string").join(""));
const byId = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props.testID === id && typeof n.type !== "string");
const press = (root: ReactTestInstance, id: string) => {
  const [node] = root.findAll(
    (n) => n.props.testID === id && typeof n.props.onPress === "function",
  );
  act(() => node?.props.onPress());
};

describe("ShowOnTvSheet", () => {
  it("shows the Screen Mirroring steps and waits for the TV", () => {
    const onClose = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ShowOnTvSheet state={{ open: true, mode: "steps" }} onClose={onClose} />);
    });
    const all = texts(tree.root);
    expect(all).toContain("Show the game on your TV");
    expect(all).toContain("Open Control Center, tap Screen Mirroring, and choose your Apple TV.");
    expect(all.some((t) => t.includes("Screen Mirroring (the two-rectangle icon)"))).toBe(true);
    expect(all.some((t) => t.includes("your controls stay on this phone"))).toBe(true);
    expect(all).toContain("Waiting for your TV…");
    expect(byId(tree.root, "audioOnlyNotice")).toHaveLength(0);
    press(tree.root, "closeShowOnTv");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says when only the sound went to the TV", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ShowOnTvSheet state={{ open: true, mode: "audio-only" }} onClose={() => {}} />,
      );
    });
    expect(byId(tree.root, "audioOnlyNotice").length).toBeGreaterThan(0);
    expect(texts(tree.root)).toContain("That sent sound only.");
    expect(texts(tree.root)).toContain("Use Screen Mirroring for the picture.");
  });

  it("the steps alone (for a sheet that is already open, like the OGS app's cast prompt)", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<AirplaySteps mode="steps" onClose={() => {}} />);
    });
    expect(byId(tree.root, "airplaySteps").length).toBeGreaterThan(0);
    expect(byId(tree.root, "showOnTvSheet")).toHaveLength(0);
  });
});

describe("AirplaySheetHost", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("follows the sheet store, after a short settle (a picker may still be closing)", () => {
    const sheet = createAirplaySheet();
    const closed = jest.fn();
    sheet.onClose(closed);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<AirplaySheetHost sheet={sheet} />);
    });
    const visible = () =>
      tree.root.findAll((n) => String(n.type) === "Modal" || n.props.visible !== undefined)[0]
        ?.props.visible;
    expect(visible()).toBe(false);
    act(() => sheet.open());
    expect(visible()).toBe(false);
    act(() => jest.advanceTimersByTime(400));
    expect(visible()).toBe(true);
    press(tree.root, "closeShowOnTv");
    expect(closed).toHaveBeenCalledWith("steps");
    expect(visible()).toBe(false);
  });

  it("hidden while the app says another sheet owns the steps", () => {
    const sheet = createAirplaySheet();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<AirplaySheetHost sheet={sheet} hidden />);
    });
    act(() => sheet.open());
    act(() => jest.advanceTimersByTime(400));
    const modal = tree.root.findAll((n) => n.props.visible !== undefined)[0];
    expect(modal?.props.visible).toBe(false);
  });
});
