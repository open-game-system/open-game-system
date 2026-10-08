import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { UpdateRequired } from "../UpdateRequired";

/** docs/acceptance/2026-10-07-beta-distribution.feature: "Update OGS" with one button, Update. */
describe("UpdateRequired", () => {
  function render(onUpdate: () => void) {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<UpdateRequired onUpdate={onUpdate} />);
    });
    if (!tree) throw new Error("not rendered");
    return tree;
  }
  const texts = (tree: ReactTestRenderer) =>
    tree.root.findAllByType("Text" as never).flatMap((t) => [t.props.children].flat());

  it("says Update OGS and offers one button, Update", () => {
    const tree = render(() => {});
    expect(texts(tree)).toContain("Update OGS");
    const buttons = tree.root.findAll(
      (n) => n.props.accessibilityRole === "button" && typeof n.type === "string",
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.accessibilityLabel).toBe("Update");
  });

  it("Update calls onUpdate", () => {
    const onUpdate = jest.fn();
    const tree = render(onUpdate);
    act(() => tree.root.findByProps({ testID: "updateRequired.update" }).props.onPress());
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
