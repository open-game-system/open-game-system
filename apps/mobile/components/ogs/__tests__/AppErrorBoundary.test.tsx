import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppErrorBoundary } from "../AppErrorBoundary";

/** A render error shows a calm screen with Try again, and is reported once (to the client log). */
function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new TypeError("cannot read 'name' of undefined");
  return null;
}

describe("AppErrorBoundary", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("reports a render error once and shows the fallback; Try again renders the children again", () => {
    const reported: unknown[] = [];
    let explode = true;
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        <AppErrorBoundary onError={(e) => reported.push(e)}>
          <Boom explode={explode} />
        </AppErrorBoundary>,
      );
    });
    if (!tree) throw new Error("not rendered");
    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(TypeError);
    const retry = tree.root.findAllByProps({ testID: "appError.retry" })[0];
    expect(tree.root.findAllByProps({ testID: "appError" }).length).toBeGreaterThan(0);

    explode = false;
    act(() => {
      tree?.update(
        <AppErrorBoundary onError={(e) => reported.push(e)}>
          <Boom explode={explode} />
        </AppErrorBoundary>,
      );
    });
    act(() => retry.props.onPress());
    expect(tree.root.findAllByProps({ testID: "appError" })).toHaveLength(0);
    expect(reported).toHaveLength(1);
  });
});
